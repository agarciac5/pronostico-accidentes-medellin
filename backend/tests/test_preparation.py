"""Pruebas de riesgos de integración y conteo, sin depender de datos privados."""
from datetime import datetime, time
from pathlib import Path
import tempfile
import unittest

import openpyxl
import pandas as pd

from data_pipeline.prepare import (COMMUNES, aggregate_panel, daily_panel, numeric_coordinate,
                                   read_accidents, read_population)


class PreparationTests(unittest.TestCase):
    def population(self):
        return pd.DataFrame([dict(comuna_id=c, anio=y, poblacion=100000)
                             for c in COMMUNES for y in range(2021, 2026)])

    def daily(self, start='2021-01-01', end='2021-01-10', missing=None):
        dates = pd.date_range(start, end)
        events = pd.DataFrame([dict(comuna_id=1, fecha=dates[0]), dict(comuna_id=1, fecha=dates[-1])])
        days = set(dates) - ({pd.Timestamp(missing)} if missing else set())
        return daily_panel(events, self.population(), days, dates[0], dates[-1])

    def test_zero_is_not_a_citywide_data_gap(self):
        frame = self.daily(missing='2021-01-05')
        self.assertEqual(frame.accidentes_registrados.sum(), 2)
        self.assertTrue(frame.loc[frame.fecha.eq('2021-01-05'), 'accidentes_registrados'].isna().all())
        self.assertTrue(frame.loc[frame.fecha.eq('2021-01-04'), 'accidentes_registrados'].eq(0).all())

    def test_partial_week_and_conservation(self):
        weekly = aggregate_panel(self.daily(), 'W-SUN')
        self.assertEqual(weekly.accidentes_registrados.sum(), 2)
        self.assertEqual(int((~weekly.periodo_completo).sum()), 16)
        self.assertTrue(weekly.loc[weekly.periodo_inicio.eq('2021-01-04'), 'periodo_completo'].all())

    def test_missing_day_blocks_weekly_target(self):
        weekly = aggregate_panel(self.daily(missing='2021-01-05'), 'W-SUN')
        affected = weekly[weekly.periodo_inicio.eq('2021-01-04')]
        self.assertTrue(affected.accidentes_registrados.isna().all())
        self.assertFalse(affected.apto_modelado_segun_cobertura.any())
        self.assertEqual(weekly.conteo_observado_archivo.sum(), 2)

    def test_numeric_coordinate_strings_and_missing_values(self):
        self.assertAlmostEqual(numeric_coordinate('6.28183705'), 6.28183705)
        self.assertIsNone(numeric_coordinate('N/D'))
        self.assertIsNone(numeric_coordinate(None))

    def test_week_crossing_validation_boundary_is_flagged(self):
        weekly = aggregate_panel(self.daily('2024-12-30', '2025-01-05'), 'W-SUN')
        self.assertEqual(set(weekly.particion_sugerida), {'cruza_particion'})

    def test_missing_population_fails_instead_of_dropping_events(self):
        pop = self.population().query('comuna_id != 16')
        events = pd.DataFrame([dict(comuna_id=1, fecha=pd.Timestamp('2021-01-01'))])
        with self.assertRaisesRegex(ValueError, 'Falta población'):
            daily_panel(events, pop, {pd.Timestamp('2021-01-01')}, pd.Timestamp('2021-01-01'), pd.Timestamp('2021-01-01'))

    def population_workbook(self, path, corrupt=False):
        wb = openpyxl.Workbook(); sheet = wb.active; sheet.title = 'Barrios - Veredas'
        sheet.append(['Código Comuna/Corregimiento', 'Nombre', 'Barrio', 'Nombre barrio', 'Área'])
        sheet.append([None] * 5 + list(range(2021, 2026)))
        for c in COMMUNES:
            sheet.append([str(c), COMMUNES[c], str(c) + '01', 'Barrio', 'Cabecera Municipal'] + [100] * 5)
            sheet.append([str(c), COMMUNES[c], str(c) + '01', 'Barrio', 'Total'] + [101 if corrupt else 100] * 5)
        wb.save(path)

    def test_population_does_not_double_count_area_plus_total(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'population.xlsx'; self.population_workbook(path)
            frame, _ = read_population(path)
            self.assertEqual(len(frame), 80)
            self.assertTrue(frame.poblacion.eq(100).all())

    def test_population_inconsistent_total_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'population.xlsx'; self.population_workbook(path, corrupt=True)
            with self.assertRaisesRegex(ValueError, 'no concilia'):
                read_population(path)

    def test_identical_duplicate_removed_but_conflict_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'accidents.xlsx'
            wb = openpyxl.Workbook(); sheet = wb.active; sheet.title = 'BD'
            sheet.append(['LLAVE', 'FECHA_INCIDENTE', 'HORA_INCIDENTE', 'CLASE_INCIDENTE',
                          'GRAVEDAD_INCIDENTE', 'Latitud', 'Longitud', 'Codigo Comuna Planeacion'])
            event = [1, datetime(2021, 1, 1), time(12), 'Choque', 'HERIDO', None, None, 1]
            sheet.append(event); sheet.append(event); wb.save(path)
            frame, _, audit, _ = read_accidents(path)
            self.assertEqual(len(frame), 1)
            self.assertEqual(audit['conteos']['duplicados_exactos_por_llave'], 1)
            self.assertFalse(frame.coordenadas_revisables.any())
            event[4] = 'MUERTO'; sheet.append(event); wb.save(path)
            with self.assertRaisesRegex(ValueError, 'contradictorio'):
                read_accidents(path)


if __name__ == '__main__':
    unittest.main()
