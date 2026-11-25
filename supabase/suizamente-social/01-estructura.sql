-- Suizamente social. Instalación aditiva; conserva votos y RPC actuales.
-- Amplía únicamente el CHECK de tipos de app_notifications, al final del archivo.
BEGIN;
CREATE SCHEMA IF NOT EXISTS suizamente_social;
REVOKE ALL ON SCHEMA suizamente_social FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS suizamente_social.cantones (
  codigo text PRIMARY KEY, nombre text NOT NULL, alias text NOT NULL
);
INSERT INTO suizamente_social.cantones VALUES
('ZH','Zúrich','Zürich'),('BE','Berna','Bern'),('LU','Lucerna','Luzern'),('UR','Uri','Uri'),
('SZ','Schwyz','Schwyz'),('OW','Obwalden','Obwalden'),('NW','Nidwalden','Nidwalden'),('GL','Glaris','Glarus'),
('ZG','Zug','Zug'),('FR','Friburgo','Fribourg'),('SO','Soleura','Solothurn'),('BS','Basilea-Ciudad','Basel-Stadt'),
('BL','Basilea-Campiña','Basel-Land'),('SH','Schaffhausen','Schaffhausen'),('AR','Appenzell Rodas Exteriores','Appenzell A.'),
('AI','Appenzell Rodas Interiores','Appenzell I.'),('SG','San Galo','St. Gallen'),('GR','Grisones','Graubünden'),
('AG','Argovia','Aargau'),('TG','Turgovia','Thurgau'),('TI','Tesino','Ticino'),('VD','Vaud','Vaud'),
('VS','Valais','Valais'),('NE','Neuchâtel','Neuchâtel'),('GE','Ginebra','Genève'),('JU','Jura','Jura')
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS suizamente_social.preguntas (
  id text PRIMARY KEY REFERENCES public.suizamente_catalogo_votos(pregunta_id),
  tipo text NOT NULL CHECK (tipo IN ('dilema','real')), tema text NOT NULL,
  correcta smallint, opciones smallint NOT NULL CHECK (opciones BETWEEN 2 AND 4),
  CHECK ((tipo='dilema' AND correcta IS NULL) OR (tipo='real' AND correcta>=0 AND correcta<opciones))
);
CREATE TABLE IF NOT EXISTS suizamente_social.jugadores (
  id text PRIMARY KEY CHECK (id ~ '^(user|anon):[a-f0-9-]{36}$'),
  usuario_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  apodo text NOT NULL DEFAULT 'Invitado', color text NOT NULL DEFAULT 'menta'
    CHECK (color IN ('menta','naranja','rojo','azul','cielo','mar')),
  pais text CHECK (pais IN ('AR','BO','CL','CO','CR','CU','DO','EC','SV','GQ','ES','GT','HN','MX','NI','PA','PY','PE','PR','UY','VE','CH','otro')),
  canton text REFERENCES suizamente_social.cantones(codigo),
  anos_suiza text CHECK (anos_suiza IN ('menos1','1a3','3a10','mas10')),
  en_ranking boolean NOT NULL DEFAULT true, ajustes jsonb NOT NULL DEFAULT '{}',
  perfil_iniciado boolean NOT NULL DEFAULT false,
  aciertos_seguidos integer NOT NULL DEFAULT 0, ultimo_acierto timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS suizamente_social.respuestas (
  jugador text REFERENCES suizamente_social.jugadores(id) ON DELETE CASCADE,
  pregunta text REFERENCES suizamente_social.preguntas(id), opcion smallint NOT NULL,
  acierto boolean, canton text REFERENCES suizamente_social.cantones(codigo),
  creado_en timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (jugador,pregunta)
);
CREATE INDEX IF NOT EXISTS sm_respuestas_fecha ON suizamente_social.respuestas(creado_en,canton,jugador);
CREATE TABLE IF NOT EXISTS suizamente_social.puntos (
  jugador text REFERENCES suizamente_social.jugadores(id) ON DELETE CASCADE,
  motivo text NOT NULL, ref text NOT NULL, cantidad integer NOT NULL CHECK (cantidad>=0),
  canton text REFERENCES suizamente_social.cantones(codigo), creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (jugador,motivo,ref)
);
CREATE INDEX IF NOT EXISTS sm_puntos_fecha ON suizamente_social.puntos(creado_en,canton,jugador);
CREATE TABLE IF NOT EXISTS suizamente_social.dias (
  fecha date PRIMARY KEY, preguntas text[] NOT NULL CHECK (cardinality(preguntas)=5)
);
CREATE TABLE IF NOT EXISTS suizamente_social.diarias (
  fecha date REFERENCES suizamente_social.dias(fecha),
  jugador text REFERENCES suizamente_social.jugadores(id) ON DELETE CASCADE,
  pregunta text REFERENCES suizamente_social.preguntas(id), opcion smallint NOT NULL, acierto boolean,
  creado_en timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (fecha,jugador,pregunta)
);
CREATE TABLE IF NOT EXISTS suizamente_social.duelos (
  codigo text PRIMARY KEY, modo text NOT NULL CHECK (modo IN ('dilemas','preguntas','mix')),
  preguntas text[] NOT NULL CHECK (cardinality(preguntas)=10),
  creador text NOT NULL REFERENCES suizamente_social.jugadores(id) ON DELETE CASCADE,
  rival text REFERENCES suizamente_social.jugadores(id) ON DELETE SET NULL,
  invitado text REFERENCES suizamente_social.jugadores(id) ON DELETE SET NULL,
  estado text NOT NULL DEFAULT 'esperando' CHECK (estado IN ('esperando','terminado','caducado')),
  creado_en timestamptz NOT NULL DEFAULT now(), caduca_en timestamptz NOT NULL DEFAULT now()+interval '72 hours',
  terminado_en timestamptz, CHECK (creador IS DISTINCT FROM rival)
);
CREATE INDEX IF NOT EXISTS sm_duelos_jugadores ON suizamente_social.duelos(creador,rival);
CREATE TABLE IF NOT EXISTS suizamente_social.duelo_respuestas (
  codigo text REFERENCES suizamente_social.duelos(codigo) ON DELETE CASCADE,
  jugador text REFERENCES suizamente_social.jugadores(id) ON DELETE CASCADE,
  pregunta text REFERENCES suizamente_social.preguntas(id), opcion smallint NOT NULL,
  punto smallint NOT NULL CHECK (punto IN (0,1)), creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (codigo,jugador,pregunta)
);
CREATE TABLE IF NOT EXISTS suizamente_social.amistades (
  solicitante text REFERENCES suizamente_social.jugadores(id) ON DELETE CASCADE,
  destinatario text REFERENCES suizamente_social.jugadores(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aceptada','bloqueada')),
  creado_en timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(solicitante,destinatario),
  CHECK (solicitante<>destinatario)
);
CREATE UNIQUE INDEX IF NOT EXISTS sm_amistad_pareja ON suizamente_social.amistades(least(solicitante,destinatario),greatest(solicitante,destinatario));
CREATE TABLE IF NOT EXISTS suizamente_social.libreta (
  jugador text REFERENCES suizamente_social.jugadores(id) ON DELETE CASCADE,
  pregunta text REFERENCES suizamente_social.preguntas(id), creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(jugador,pregunta)
);
CREATE TABLE IF NOT EXISTS suizamente_social.medallas (
  jugador text REFERENCES suizamente_social.jugadores(id) ON DELETE CASCADE,
  medalla text NOT NULL, creado_en timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(jugador,medalla)
);
CREATE TABLE IF NOT EXISTS suizamente_social.propuestas (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  jugador text REFERENCES suizamente_social.jugadores(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('dilema','real','mito','correccion')),
  tema text NOT NULL, pregunta text NOT NULL CHECK (length(pregunta) BETWEEN 5 AND 140),
  opciones jsonb, correcta smallint, dato text NOT NULL CHECK (length(dato) BETWEEN 5 AND 300),
  fuente text CHECK (length(fuente)<=500), estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','aprobada','rechazada','publicada')),
  nota text CHECK (length(nota)<=500), pregunta_id text REFERENCES suizamente_social.preguntas(id),
  creado_en timestamptz NOT NULL DEFAULT now(), revisado_en timestamptz
);
CREATE TABLE IF NOT EXISTS suizamente_social.limites (
  clave text PRIMARY KEY, ventana timestamptz NOT NULL, cantidad integer NOT NULL
);

-- Sin políticas de acceso directo: solo la RPC de servicio validada por la Edge Function.
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='suizamente_social' LOOP
    EXECUTE format('ALTER TABLE suizamente_social.%I ENABLE ROW LEVEL SECURITY',t.tablename);
    EXECUTE format('REVOKE ALL ON suizamente_social.%I FROM PUBLIC, anon, authenticated',t.tablename);
  END LOOP;
END $$;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA suizamente_social FROM PUBLIC,anon,authenticated;

-- Amplía el CHECK de tipos de avisos conservando íntegro su predicado actual.
-- No borra avisos, columnas ni permisos. Se ejecuta dentro de la transacción.
DO $$ DECLARE regla record; BEGIN
  FOR regla IN SELECT conname,pg_get_expr(conbin,conrelid) expresion FROM pg_constraint
    WHERE conrelid='public.app_notifications'::regclass AND contype='c'
      AND pg_get_expr(conbin,conrelid) ~ '\mkind\M' LOOP
    IF position('''suizamente''' IN regla.expresion)=0 THEN
      EXECUTE format('ALTER TABLE public.app_notifications DROP CONSTRAINT %I',regla.conname);
      EXECUTE format('ALTER TABLE public.app_notifications ADD CONSTRAINT %I CHECK ((%s) OR kind = %L)',regla.conname,regla.expresion,'suizamente');
    END IF;
  END LOOP;
END $$;
COMMIT;
