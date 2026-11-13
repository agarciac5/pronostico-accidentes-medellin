"""Ejecutar desde backend: python -m data_pipeline.prepare.

Bronce: Excel originales. Plata: incidentes seleccionados y población homologada.
Oro: paneles comuna-periodo y tablas descriptivas. No entrena modelos.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, time
import hashlib
import json
from pathlib import Path
import platform

import openpyxl
import pandas as pd

START = pd.Timestamp('2021-01-01')
END = pd.Timestamp('2025-08-31')
EDA_END = pd.Timestamp('2023-12-31')
NAMES = ['Popular', 'Santa Cruz', 'Manrique', 'Aranjuez', 'Castilla',
         'Doce de Octubre', 'Robledo', 'Villa Hermosa', 'Buenos Aires',
         'La Candelaria', 'Laureles-Estadio', 'La América', 'San Javier',
         'El Poblado', 'Guayabal', 'Belén']
COMMUNES = dict(enumerate(NAMES, 1))


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def commune_code(value):
    try:
        number = float(value)
        return int(number) if number.is_integer() else None
    except (TypeError, ValueError):
        return None


def hour(value):
    if isinstance(value, (datetime, time)):
        return value.hour
    try:
        return datetime.strptime(str(value), '%H:%M:%S').hour
    except ValueError:
        try:
            return datetime.strptime(str(value), '%H:%M').hour
        except ValueError:
            return None


def numeric_coordinate(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def read_accidents(path: Path):
    with path.open('rb') as source:
        return _read_accidents(source)


def _read_accidents(path):
    """Lee una vez el Excel completo y conserva auditoría de exclusiones disjuntas.

    LLAVE repetida idéntica se conserva una sola vez; una llave contradictoria
    detiene el proceso. No se deduplican eventos distintos por compartir atributos.
    """
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheet = workbook['BD']
    iterator = sheet.iter_rows(values_only=True)
    headers = next(iterator)
    expected = ['LLAVE', 'FECHA_INCIDENTE', 'HORA_INCIDENTE', 'CLASE_INCIDENTE',
                'GRAVEDAD_INCIDENTE', 'Latitud', 'Longitud', 'Codigo Comuna Planeacion']
    positions = {name: headers.index(name) for name in expected}
    counts, quality, severity, yearly = Counter(), Counter(), Counter(), Counter()
    observed_days, keys, records = set(), {}, []
    excluded = Counter()
    for row in iterator:
        counts['filas_originales'] += 1
        key = row[positions['LLAVE']]
        if key is None:
            raise ValueError('LLAVE vacía: revisar identidad antes de agregar.')
        # Hash de toda la fila para no ocultar conflictos en campos no seleccionados.
        signature = hashlib.sha256(repr(row).encode('utf-8')).digest()
        if key in keys:
            if keys[key] != signature:
                raise ValueError(f'LLAVE con contenido contradictorio: {key}')
            counts['duplicados_exactos_por_llave'] += 1
            continue
        keys[key] = signature
        date = row[positions['FECHA_INCIDENTE']]
        if not isinstance(date, datetime):
            excluded['fecha_invalida'] += 1
            continue
        date = pd.Timestamp(date).normalize()
        sev = str(row[positions['GRAVEDAD_INCIDENTE']]).strip().upper()
        yearly[(date.year, sev)] += 1
        if not START <= date <= END:
            excluded['fuera_ventana'] += 1
            continue
        counts['filas_ventana'] += 1
        observed_days.add(date)
        severity[sev] += 1
        for name, index in positions.items():
            if row[index] is None or str(row[index]).strip() in ('', 'N/D', 'Sin inf'):
                quality[name] += 1
        if sev not in ('HERIDO', 'MUERTO'):
            excluded['sin_victimas_o_gravedad_no_objetivo'] += 1
            continue
        counts['victimas_ventana'] += 1
        code = commune_code(row[positions['Codigo Comuna Planeacion']])
        if code not in COMMUNES:
            excluded['comuna_rural' if code in (50, 60, 70, 80, 90) else 'comuna_no_asignable'] += 1
            continue
        lat, lon = (numeric_coordinate(row[positions[name]]) for name in ('Latitud', 'Longitud'))
        coords_ok = isinstance(lat, (int, float)) and isinstance(lon, (int, float))
        # Caja de revisión amplia, no prueba de pertenencia al polígono municipal.
        coords_ok = coords_ok and 6.0 <= lat <= 6.5 and -75.8 <= lon <= -75.4
        records.append(dict(llave=key, fecha=date, hora=hour(row[positions['HORA_INCIDENTE']]),
                            clase=str(row[positions['CLASE_INCIDENTE']]).strip(), gravedad=sev,
                            comuna_id=code, latitud=lat, longitud=lon,
                            coordenadas_revisables=bool(coords_ok)))
    workbook.close()
    data = pd.DataFrame(records)
    if data.empty:
        raise ValueError('No quedaron incidentes urbanos con víctimas.')
    data['hora'] = data.hora.astype('Int64')
    data = data.sort_values(['fecha', 'comuna_id', 'llave']).reset_index(drop=True)
    counts['incidentes_seleccionados'] = len(data)
    if sum(excluded.values()) + len(data) + counts['duplicados_exactos_por_llave'] != counts['filas_originales']:
        raise AssertionError('Las exclusiones no concilian con el original.')
    audit = dict(conteos=dict(counts), exclusiones_disjuntas=dict(excluded),
                 faltantes_ventana=dict(quality), gravedad_ventana=dict(severity),
                 coordenadas_no_utilizables_seleccion=int((~data.coordenadas_revisables).sum()),
                 coordenadas_revisables_seleccion=int(data.coordenadas_revisables.sum()),
                 horas_no_utilizables_seleccion=int(data.hora.isna().sum()),
                 fecha_inicio=str(START.date()), fecha_fin=str(END.date()))
    years = pd.DataFrame([dict(anio=y, gravedad=s, registros=n) for (y, s), n in sorted(yearly.items())])
    return data, observed_days, audit, years


def read_population(path: Path):
    with path.open('rb') as source:
        return _read_population(source)


def _read_population(path):
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheet = workbook['Barrios - Veredas']
    rows = list(sheet.values)
    header_index = next(i for i, r in enumerate(rows) if r[0] == 'Código Comuna/Corregimiento')
    years = rows[header_index + 1]
    year_columns = [(i, v) for i, v in enumerate(years) if isinstance(v, int) and 2021 <= v <= 2025]
    if [v for _, v in year_columns] != list(range(2021, 2026)):
        raise ValueError('Años de población inesperados.')
    seen, records, checked = set(), [], 0
    source_rows = rows[header_index + 2:]
    # Comprueba que cada Total sea la suma de las áreas geográficas, sin sumarlo otra vez.
    for row in source_rows:
        code = commune_code(row[0])
        if code not in COMMUNES or row[4] != 'Total':
            continue
        key = (code, str(row[2]))
        if key in seen:
            raise ValueError(f'Barrio Total repetido: {key}')
        seen.add(key)
        parts = [r for r in source_rows if commune_code(r[0]) == code
                 and r[2] == row[2] and r[4] in ('Cabecera Municipal', 'Centros Poblados y Rural Disperso')]
        if not parts:
            raise ValueError(f'Sin áreas para contrastar Total: {key}')
        for i, year in year_columns:
            value = row[i]
            if not isinstance(value, (int, float)) or value < 0 or int(value) != value:
                raise ValueError(f'Población inválida: {key}, {year}')
            if any(not isinstance(p[i], (int, float)) for p in parts) or sum(p[i] for p in parts) != value:
                raise ValueError(f'Total no concilia con áreas: {key}, {year}')
            records.append(dict(comuna_id=code, barrio_id=str(row[2]), anio=year, poblacion=int(value)))
        checked += 1
    workbook.close()
    barrios = pd.DataFrame(records)
    result = barrios.groupby(['comuna_id', 'anio'], as_index=False).poblacion.sum()
    if len(result) != 80 or result.poblacion.le(0).any():
        raise ValueError('Se requieren 16 comunas por 5 años con población positiva.')
    notes = [str(r[0]) for r in rows if r[0] and ('Fuente:' in str(r[0]) or 'Actualizado' in str(r[0]))]
    return result, dict(hoja='Barrios - Veredas', area_elegida='Total',
                        barrios_urbanos=checked, filas_comuna_anio=len(result), notas_fuente=notes,
                        uso='Contexto descriptivo retrospectivo; versión no acreditada para backtesting predictivo.')


def daily_panel(incidents, population, observed_days, start=START, end=END):
    index = pd.MultiIndex.from_product([range(1, 17), pd.date_range(start, end)], names=['comuna_id', 'fecha'])
    counts = incidents.groupby(['comuna_id', 'fecha']).size().reindex(index, fill_value=0)
    result = counts.rename('accidentes_registrados').reset_index()
    result['conteo_observado_archivo'] = result.accidentes_registrados
    result['fuente_con_registros_ciudad'] = result.fecha.isin(observed_days)
    result['accidentes_registrados'] = result.accidentes_registrados.astype('Int64')
    result.loc[~result.fuente_con_registros_ciudad, 'accidentes_registrados'] = pd.NA
    result['anio'] = result.fecha.dt.year
    result = result.merge(population, on=['comuna_id', 'anio'], how='left', validate='many_to_one')
    if result.poblacion.isna().any():
        raise ValueError('Falta población para una comuna-año.')
    result['comuna_nombre'] = result.comuna_id.map(COMMUNES)
    result['particion_sugerida'] = result.fecha.map(lambda d: 'entrenamiento' if d <= EDA_END else 'validacion' if d.year == 2024 else 'prueba')
    return result


def aggregate_panel(daily, frequency):
    """Semana lunes-domingo o mes calendario. Incluye y marca bordes incompletos."""
    if frequency not in ('W-SUN', 'M'):
        raise ValueError('Frecuencia debe ser W-SUN o M.')
    source = daily.copy()
    source['periodo_inicio'] = source.fecha.dt.to_period(frequency).dt.start_time
    result = source.groupby(['comuna_id', 'periodo_inicio'], as_index=False).agg(
        accidentes_registrados=('accidentes_registrados', lambda s: s.sum(min_count=1)),
        conteo_observado_archivo=('conteo_observado_archivo', 'sum'),
        dias_observados=('fecha', 'size'), dias_con_registros_ciudad=('fuente_con_registros_ciudad', 'sum'),
        poblacion_media_contexto=('poblacion', 'mean'))
    result['periodo_fin'] = result.periodo_inicio.dt.to_period(frequency).dt.end_time.dt.normalize()
    result['dias_esperados'] = (result.periodo_fin - result.periodo_inicio).dt.days + 1
    result['periodo_completo'] = result.dias_observados.eq(result.dias_esperados)
    result['sin_huecos_detectados_ciudad'] = result.dias_con_registros_ciudad.eq(result.dias_observados)
    result['apto_modelado_segun_cobertura'] = result.periodo_completo & result.sin_huecos_detectados_ciudad
    result.loc[~result.sin_huecos_detectados_ciudad, 'accidentes_registrados'] = pd.NA
    result['comuna_nombre'] = result.comuna_id.map(COMMUNES)
    # Semanas que cruzan dos particiones no deben entrar a ninguna por defecto.
    ends = result.periodo_fin
    result['particion_sugerida'] = ends.map(lambda d: 'entrenamiento' if d <= EDA_END else 'validacion' if d.year == 2024 else 'prueba')
    starts = result.periodo_inicio.map(lambda d: 'entrenamiento' if d <= EDA_END else 'validacion' if d.year == 2024 else 'prueba')
    result.loc[starts != result.particion_sugerida, 'particion_sugerida'] = 'cruza_particion'
    result['tasa_contextual_100mil'] = result.accidentes_registrados / result.poblacion_media_contexto * 100000
    return result


def geospatial_candidates(incidents):
    columns = ['fecha', 'hora', 'clase', 'gravedad', 'comuna_id', 'latitud', 'longitud']
    return incidents.loc[incidents.coordenadas_revisables, columns].reset_index(drop=True)


def save_table(frame, path):
    frame.to_parquet(path.with_suffix('.parquet'), index=False)
    frame.to_csv(path.with_suffix('.csv'), index=False, encoding='utf-8')


def eda(incidents, daily, output):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    output.mkdir(parents=True, exist_ok=True)
    train = incidents[incidents.fecha <= EDA_END].copy()
    train['dia_semana'] = train.fecha.dt.dayofweek
    train['franja'] = pd.cut(train.hora.astype('float64'), [-1, 5, 11, 17, 23], labels=['00–05', '06–11', '12–17', '18–23'])
    ranking = train.groupby('comuna_id').size().rename('accidentes_registrados').reset_index()
    ranking['comuna_nombre'] = ranking.comuna_id.map(COMMUNES)
    ranking = ranking.sort_values('accidentes_registrados', ascending=False)
    ranking.to_csv(output / 'conteos_comuna_entrenamiento.csv', index=False)
    monthly = train.groupby(train.fecha.dt.to_period('M')).size()
    daily_train = daily[daily.fecha <= EDA_END].copy()
    calendar_train = daily_train[daily_train.comuna_id == 1].copy()
    complete_months = calendar_train.groupby(calendar_train.fecha.dt.to_period('M')).fuente_con_registros_ciudad.all()
    monthly_table = monthly.rename('conteo_observado_archivo').to_frame()
    monthly_table['sin_huecos_detectados_ciudad'] = complete_months
    monthly_table.to_csv(output / 'conteos_mes_entrenamiento.csv')
    daily_train.groupby('comuna_id').accidentes_registrados.describe().to_csv(output / 'estadisticas_diarias_entrenamiento.csv')
    train.groupby(['clase', 'gravedad']).size().rename('incidentes').to_csv(output / 'clase_gravedad_entrenamiento.csv')
    heat = pd.crosstab(train.dia_semana, train.franja).reindex(index=range(7), columns=['00–05', '06–11', '12–17', '18–23'], fill_value=0)
    heat.to_csv(output / 'dia_franja_entrenamiento.csv')
    # Frecuencia por día disponible para no confundir exposición de calendario con intensidad.
    calendar = daily[(daily.comuna_id == 1) & (daily.fecha <= EDA_END) & daily.fuente_con_registros_ciudad]
    exposures = calendar.fecha.dt.dayofweek.value_counts().reindex(range(7), fill_value=0)
    mean_heat = heat.div(exposures.replace(0, float('nan')), axis=0)
    mean_heat.to_csv(output / 'promedio_dia_franja_entrenamiento.csv')
    plt.rcParams.update({'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False})
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(monthly.index.to_timestamp(), monthly.values, color='#176b60')
    incomplete = monthly[~complete_months.reindex(monthly.index)]
    if len(incomplete):
        ax.scatter(incomplete.index.to_timestamp(), incomplete.values, marker='^', color='#b84d13',
                   s=65, zorder=3, label='Mes con días sin registros de ciudad')
        ax.legend(loc='lower center', fontsize=9)
    ax.set(title='Accidentes registrados con víctimas · 16 comunas · 2021–2023', ylabel='Accidentes por mes', xlabel='Mes')
    fig.tight_layout(); fig.savefig(output / 'tendencia_mensual.png', dpi=160); plt.close(fig)
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.barh(ranking.comuna_nombre[::-1], ranking.accidentes_registrados[::-1], color='#176b60')
    ax.set(title='Conteos por comuna · 2021–2023', xlabel='Accidentes registrados con víctimas')
    fig.tight_layout(); fig.savefig(output / 'conteos_comuna.png', dpi=160); plt.close(fig)
    fig, ax = plt.subplots(figsize=(8, 4))
    image = ax.imshow(mean_heat.to_numpy(dtype=float), cmap='YlGnBu', aspect='auto')
    ax.set(xticks=range(4), xticklabels=list(mean_heat.columns), yticks=range(7),
           yticklabels=['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
           title='Promedio por día de semana y franja · 2021–2023', xlabel='Hora local del registro')
    fig.colorbar(image, ax=ax, label='Accidentes por día de ese tipo y franja')
    fig.tight_layout(); fig.savefig(output / 'dia_franja.png', dpi=160); plt.close(fig)
    return dict(incidentes_entrenamiento=len(train), comuna_mayor_conteo=str(ranking.iloc[0].comuna_nombre),
                dias_con_cero_registrado=int(((daily.fecha <= EDA_END) & daily.accidentes_registrados.eq(0)).sum()),
                horas_sin_franja=int(train.franja.isna().sum()))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--accidents', type=Path, default=Path('datasets/Fatal_Road_Traffic.xlsx'))
    parser.add_argument('--population', type=Path, default=Path('datasets/poblacion_barrios_veredas.xlsx'))
    args = parser.parse_args()
    base = Path(__file__).resolve().parents[1]
    for name in ('accidents', 'population'):
        value = getattr(args, name)
        setattr(args, name, value if value.is_absolute() else base / value)
        if not getattr(args, name).is_file():
            parser.error(f'No existe {name}: {getattr(args, name)}. Ver docs/DATOS.md.')
    silver, gold, reports = base / 'data/interim', base / 'data/processed', base.parent / 'docs/eda'
    for directory in (silver, gold, reports):
        directory.mkdir(parents=True, exist_ok=True)
    print('Leyendo y auditando incidentes...', flush=True)
    incidents, days, audit, yearly = read_accidents(args.accidents)
    population, pop_audit = read_population(args.population)
    daily = daily_panel(incidents, population, days)
    weekly, monthly = aggregate_panel(daily, 'W-SUN'), aggregate_panel(daily, 'M')
    if int(daily.accidentes_registrados.sum()) != len(incidents):
        raise AssertionError('No concilian incidentes y panel diario.')
    for name, panel in [('semanal', weekly), ('mensual', monthly)]:
        if int(panel.conteo_observado_archivo.sum()) != len(incidents):
            raise AssertionError(f'No concilia panel {name}; revisar cobertura antes de continuar.')
    incidents.to_parquet(silver / 'incidentes_urbanos.parquet', index=False)
    points = geospatial_candidates(incidents)
    points.to_parquet(gold / 'incidentes_puntos_candidatos.parquet', index=False)
    points.to_csv(gold / 'incidentes_puntos_candidatos.csv', index=False, encoding='utf-8')
    save_table(population, gold / 'poblacion_comuna_anio')
    save_table(daily, gold / 'serie_diaria')
    save_table(weekly, gold / 'serie_semanal')
    save_table(monthly, gold / 'serie_mensual')
    yearly.to_csv(reports / 'cobertura_anual_gravedad.csv', index=False)
    manifest = dict(version_pipeline=1, python=platform.python_version(),
                    fuentes={key:dict(archivo=path.name, bytes=path.stat().st_size, sha256=sha256(path))
                             for key, path in [('accidentes', args.accidents), ('poblacion', args.population)]},
                    accidentes=audit, poblacion=pop_audit,
                    dias_sin_registros_ciudad=[str(d.date()) for d in pd.date_range(START, END) if d not in days],
                    paneles={name:dict(filas=len(df), registros_archivo=int(df.conteo_observado_archivo.sum()),
                                       filas_target_nulo=int(df.accidentes_registrados.isna().sum()),
                                       periodos_incompletos=int((~df.periodo_completo).sum()))
                             for name, df in [('semanal', weekly), ('mensual', monthly)]},
                    eda=eda(incidents, daily, reports))
    (reports / 'auditoria.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    write_summary(manifest, reports, len(daily), len(incidents))
    print(json.dumps(dict(incidentes=len(incidents), filas_diarias=len(daily), poblacion=len(population)), ensure_ascii=False))


def write_summary(manifest, reports, daily_rows, incident_rows):
    audit = manifest['accidentes']
    gaps = manifest['dias_sin_registros_ciudad']
    summary = f'''# Diagnóstico y exploración inicial

Resultado reproducible de `python -m data_pipeline.prepare`. Esta etapa prepara datos; no acredita modelos entrenados ni rendimiento predictivo.

## Control de registros

- Original: {audit['conteos']['filas_originales']:,} filas.
- Ventana 2021–agosto de 2025: {audit['conteos']['filas_ventana']:,} filas de todas las gravedades.
- Incidentes con víctimas en las 16 comunas: {incident_rows:,}.
- Población: {manifest['poblacion']['filas_comuna_anio']} combinaciones comuna-año, agregadas desde {manifest['poblacion']['barrios_urbanos']} unidades territoriales.
- Panel diario: {daily_rows:,} combinaciones comuna-fecha.
- Días sin registros de ninguna gravedad en la ciudad: {len(gaps)}. Fechas: {', '.join(gaps) or 'ninguna'}.
- Filas comuna-semana de borde incompleto: {manifest['paneles']['semanal']['periodos_incompletos']}.
- Filas comuna-semana con target nulo por huecos de fuente: {manifest['paneles']['semanal']['filas_target_nulo']}.
- Incidentes seleccionados sin coordenadas utilizables en el control preliminar: {audit['coordenadas_no_utilizables_seleccion']:,}; se conservan para conteos.

Las exclusiones disjuntas y hashes de los insumos están en [auditoria.json](auditoria.json). La suma del conteo observado en archivo concilia entre incidentes y las tres escalas. Un total registrado no garantiza completitud administrativa.

## Exploración reservada al entrenamiento

La exploración de patrones usa únicamente 2021–2023, con {manifest['eda']['incidentes_entrenamiento']:,} incidentes. La separación temporal es provisional y debe acordarse con el responsable de modelado. La comuna con mayor conteo en ese periodo es {manifest['eda']['comuna_mayor_conteo']}; esto no equivale al mayor riesgo individual.

![Evolución mensual del entrenamiento](tendencia_mensual.png)

![Conteos por comuna del entrenamiento](conteos_comuna.png)

![Promedio por día y franja del entrenamiento](dia_franja.png)

## Límites para interpretar

Las figuras describen registros, no explican causas. Un cero significa ausencia de eventos objetivo registrados, no ausencia demostrada de accidentes. La validación de cobertura por comuna sigue pendiente. Los periodos con huecos o bordes incompletos deben excluirse del modelado de periodos completos.

La población es una proyección para contexto retrospectivo. El archivo indica actualización posterior al final del histórico de accidentes. No debe usarse automáticamente como variable disponible en un pronóstico histórico. Ver [reglas y relación con las materias](../DATOS.md).
'''
    (reports / 'RESUMEN.md').write_text(summary, encoding='utf-8')


if __name__ == '__main__':
    main()
