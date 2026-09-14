-- Script para insertar prestaciones faltantes de septiembre 2026 con horarios escalonados
-- Generado desde PROFESIONALES ACTIVOS DE INLCUIR SALUD 2.xlsx

-- 1. Tabla temporal con los pares profesional-paciente del Excel y sus días/horario
CREATE TABLE IF NOT EXISTS _tmp_expected (
  prof_dni text,
  pac_dni text,
  dias int[],
  hora int
);

TRUNCATE _tmp_expected;

INSERT INTO _tmp_expected (prof_dni, pac_dni, dias, hora)
VALUES
('13998534','21373637',ARRAY[1, 2, 3],8,
('13998534','23993468',ARRAY[1, 2, 3],8,
('13998534','35144093',ARRAY[1, 2, 3],8,
('22401977','14169525',ARRAY[1, 2, 3],8,
('22401977','47724082',ARRAY[1, 2, 3],8,
('22401977','48609528',ARRAY[1, 2, 3, 4, 5],8,
('22401977','50035457',ARRAY[1, 2, 3, 4, 5],8,
('22401977','58471998',ARRAY[1, 2, 3],8,
('23342956','50447185',ARRAY[1, 2, 3],8,
('24067771','17721762',ARRAY[1, 2, 3],8,
('24067771','24192349',ARRAY[1, 2, 3],8,
('24670342','21740389',ARRAY[1, 2, 3],8,
('24670342','22077740',ARRAY[1, 2, 3, 4, 5],8,
('24670342','40001669',ARRAY[1, 2, 3],8,
('24670342','40102299',ARRAY[1, 2, 3],8,
('24670342','49821345',ARRAY[1, 2, 3],8,
('24670342','92640023',ARRAY[1, 2, 3],8,
('24917773','40865183',ARRAY[1, 2, 3],8,
('24917773','57793191',ARRAY[1, 2, 3],8,
('25649002','39383629',ARRAY[1, 2, 3],8,
('25649002','41084530',ARRAY[1, 2, 3, 4, 5],8,
('25649002','44746803',ARRAY[1, 2, 3],8,
('25649002','53947123',ARRAY[1, 2, 3],8,
('25649002','58277049',ARRAY[1, 2, 3],8,
('26908807','41795783',ARRAY[2, 4],8,
('26936669','16694631',ARRAY[1, 2, 3],8,
('26936669','24381640',ARRAY[1, 2, 3],8,
('26936669','25984854',ARRAY[1, 2, 3, 4, 5],8,
('26936669','28564384',ARRAY[1, 2, 3],8,
('26936669','33461852',ARRAY[1, 2, 3],8,
('26936669','36419018',ARRAY[1, 2, 3],8,
('26936669','40369736',ARRAY[1, 2, 3],8,
('26936669','4736389',ARRAY[1, 2, 3],8,
('27062267','21515923',ARRAY[1, 2, 3],8,
('27062267','27405004',ARRAY[1, 2, 3],8,
('27062267','50478864',ARRAY[1, 2, 3],8,
('27062267','57584731',ARRAY[1, 2, 3],8,
('27874856','40271901',ARRAY[1, 2],8,
('27874856','56804529',ARRAY[1, 2, 3],8,
('28701797','22392341',ARRAY[1, 2, 3],8,
('28701797','36582589',ARRAY[1, 2, 3],8,
('28701797','58413242',ARRAY[1, 2, 3],8,
('28865841','45877274',ARRAY[1, 2, 3],8,
('29533257','17013477',ARRAY[1, 2, 3],8,
('30767927','16420631',ARRAY[1, 2, 3],8,
('30767927','21372291',ARRAY[1, 2, 3],8,
('30767927','23693698',ARRAY[1, 2, 3],8,
('30767927','26813313',ARRAY[1, 2, 3],8,
('30767927','27580256',ARRAY[1, 2, 3],8,
('30767927','29918039',ARRAY[1, 2, 3],8,
('30767927','35871188',ARRAY[1, 2, 3],8,
('30767927','40271403',ARRAY[1, 2, 3],8,
('30767927','53157318',ARRAY[1, 2],8,
('30767927','53482568',ARRAY[1, 2, 3, 4, 5],8,
('30767927','56289915',ARRAY[1, 2, 3],8,
('30767927','8158557',ARRAY[1, 2, 3],8,
('30767927','92669171',ARRAY[1, 2, 3],8,
('31278050','27984473',ARRAY[1, 2, 3],8,
('31278050','34763589',ARRAY[1, 2, 3],8,
('31278050','36137867',ARRAY[1, 2, 3],8,
('31549303','26838293',ARRAY[1, 2],8,
('31549303','28893431',ARRAY[1, 2, 3],8,
('31549303','39531438',ARRAY[1, 2, 3],8,
('31549303','40217769',ARRAY[1, 2, 3],8,
('31549303','44819232',ARRAY[1, 2, 3],8,
('31549303','54439627',ARRAY[1, 2, 3],8,
('31778286','45875081',ARRAY[1, 2, 3],8,
('31778286','53482624',ARRAY[1, 2, 3],8,
('32624250','32651978',ARRAY[1, 2, 3],8,
('32624250','48075614',ARRAY[1, 2, 3],8,
('32624250','50517405',ARRAY[1, 2, 3],8,
('32624250','56290247',ARRAY[1, 2, 3],8,
('33276939','52354383',ARRAY[1, 2, 3],8,
('33276939','53161259',ARRAY[1, 2, 3],8,
('33630468','26219170',ARRAY[1, 2],8,
('33630468','36890567',ARRAY[1, 2, 3],8,
('33630468','39531274',ARRAY[1, 2, 3],8,
('33630468','47968859',ARRAY[1, 2, 3],8,
('33821571','46473787',ARRAY[1, 2, 3],8,
('34625270','37125161',ARRAY[1, 2, 3],8,
('34625270','47529918',ARRAY[1, 2, 5],8,
('34675368','18328794',ARRAY[1, 2, 3],8,
('34675368','37002693',ARRAY[1, 2, 3],8,
('34675368','44625657',ARRAY[1, 2, 3],8,
('34675368','44904122',ARRAY[1, 2, 3],8,
('34675368','47194083',ARRAY[1, 2, 3],8,
('34675368','48667760',ARRAY[1, 2, 3],8,
('34675368','56289427',ARRAY[1, 2, 3],8,
('34753782','48667966',ARRAY[1, 2, 3],8,
('34753782','92502506',ARRAY[1, 2, 3],8,
('34756232','46665493',ARRAY[1, 2, 3],8,
('34756232','49488617',ARRAY[1, 2, 3, 4, 5],8,
('34756232','49855481',ARRAY[2, 4],8,
('34756232','50294708',ARRAY[2, 4],8,
('34756232','53490720',ARRAY[1, 2, 3],8,
('34756232','54689538',ARRAY[1, 2, 3],8,
('35036413','41030772',ARRAY[1, 2, 3],8,
('35036413','45255079',ARRAY[2],8,
('35036413','45255101',ARRAY[1, 2, 3],8,
('35516122','20835208',ARRAY[1, 2, 3],8,
('35516122','29205456',ARRAY[1, 2, 3],8,
('35516122','32360162',ARRAY[1, 2, 3],8,
('35516122','36962538',ARRAY[1, 2, 3],8,
('35516122','38756730',ARRAY[1, 2, 3],8,
('35560288','34194822',ARRAY[1, 2, 3],8,
('35614454','37615027',ARRAY[1, 2, 3],8,
('35614454','39064425',ARRAY[1, 2, 3],8,
('35614454','49922167',ARRAY[1, 2, 3],8,
('35615934','12794991',ARRAY[1, 2, 3],8,
('35615934','41367492',ARRAY[1, 2, 3],8,
('35875426','52289835',ARRAY[1, 2, 3],8,
('35875426','52519084',ARRAY[1, 2, 3],8,
('35896470','37138121',ARRAY[1, 2],8,
('35908848','29015745',ARRAY[1, 2, 3],8,
('35908848','56327496',ARRAY[1, 2, 3],8,
('35908848','59465072',ARRAY[1, 2, 3],8,
('35927801','13992810',ARRAY[1, 2, 3],8,
('35927801','21809903',ARRAY[1, 2, 3],8,
('35927801','22939719',ARRAY[1, 2, 3],8,
('35927801','24566325',ARRAY[1, 2, 3],8,
('35927801','26297751',ARRAY[1, 2, 3],8,
('35927801','33168097',ARRAY[1, 2, 3],8,
('35927801','43968589',ARRAY[1, 2, 3, 4, 5],8,
('36169256','18658951',ARRAY[1, 2, 3],8,
('36169256','22306939',ARRAY[1, 2, 3],8,
('36591609','36890462',ARRAY[1, 2, 3],8,
('36591609','58282552',ARRAY[1, 2, 3],8,
('36629064','51320148',ARRAY[1, 2, 3],8,
('36629064','52685443',ARRAY[1, 2, 3],8,
('37009995','26828526',ARRAY[1, 2, 3],8,
('37412812','13734648',ARRAY[1, 2, 3],8,
('37412812','22120103',ARRAY[1, 2, 3],8,
('37412812','26055551',ARRAY[1, 2, 3],8,
('37412812','47195442',ARRAY[1, 2, 3],8,
('37412812','50516778',ARRAY[1, 2, 3],8,
('37514737','20559323',ARRAY[1, 2, 3],8,
('37514737','54172276',ARRAY[1, 2, 3],8,
('37514737','57365007',ARRAY[1, 2, 3, 4, 5],8,
('37514737','8456107',ARRAY[1, 2, 3],8,
('37613306','21596898',ARRAY[1, 2, 3],8,
('37613306','52681376',ARRAY[1, 2, 3],8,
('37613306','58470683',ARRAY[1, 2, 3],8,
('37966048','24437834',ARRAY[1, 2, 3],8,
('37966048','37513474',ARRAY[1, 2, 3],8;

-- 2. Insertar solo las prestaciones que faltan, con hora escalonada
WITH expected_dates AS (
  SELECT pr.id as user_id,
         pac.id as paciente_id,
         'Kinesiología'::tipo_prestacion as tipo,
         e.hora,
         f.dia
  FROM _tmp_expected e
  JOIN profiles pr ON NULLIF(regexp_replace(pr.documento, '[^0-9]', '', 'g'), '')::bigint = e.prof_dni::bigint
  JOIN pacientes pac ON NULLIF(regexp_replace(pac.documento, '[^0-9]', '', 'g'), '')::bigint = e.pac_dni::bigint
  CROSS JOIN generate_series('2026-09-01'::date, '2026-09-30'::date, '1 day'::interval) f(dia)
  WHERE EXTRACT(DOW FROM f.dia) = ANY(e.dias)
),
existing AS (
  SELECT p.user_id, p.paciente_id, (p.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date as dia
  FROM prestaciones p
  WHERE p.tipo_prestacion = 'Kinesiología'
    AND p.fecha >= '2026-09-01' AND p.fecha < '2026-10-01'
    AND p.centro_id IS NULL
    AND p.estado <> 'cancelada'
),
missing AS (
  SELECT ed.*
  FROM expected_dates ed
  LEFT JOIN existing ex ON ex.user_id = ed.user_id AND ex.paciente_id = ed.paciente_id AND ex.dia = ed.dia
  WHERE ex.dia IS NULL
),
existing_hours AS (
  SELECT user_id,
         (fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date as dia,
         MAX(EXTRACT(HOUR FROM (fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')))::int as max_hora
  FROM prestaciones
  WHERE tipo_prestacion = 'Kinesiología'
    AND fecha >= '2026-09-01' AND fecha < '2026-10-01'
    AND centro_id IS NULL
    AND estado <> 'cancelada'
  GROUP BY user_id, (fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
),
to_insert AS (
  SELECT
    m.user_id,
    m.paciente_id,
    m.tipo,
    m.dia,
    m.hora,
    (COALESCE(eh.max_hora, m.hora - 1) + ROW_NUMBER() OVER (PARTITION BY m.user_id, m.dia ORDER BY m.paciente_id))::int as final_hour
  FROM missing m
  LEFT JOIN existing_hours eh ON eh.user_id = m.user_id AND eh.dia = m.dia
)
INSERT INTO prestaciones (user_id, paciente_id, tipo_prestacion, fecha, cronico, centro_id)
SELECT
  user_id,
  paciente_id,
  tipo,
  (to_char(dia,'YYYY-MM-DD') || ' ' || to_char(final_hour,'FM00') || ':00:00-03')::timestamptz,
  false,
  null
FROM to_insert;

-- 3. Limpieza
DROP TABLE IF EXISTS _tmp_expected;
