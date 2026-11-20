-- Suizamente social: ejecutar completo en Supabase SQL Editor.
-- Instalación aditiva e idempotente. Conserva votos y datos existentes.
BEGIN;
-- 01-estructura
-- Suizamente social. Instalación aditiva; conserva votos y RPC actuales.
-- Amplía únicamente el CHECK de tipos de app_notifications, al final del archivo.

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
  correcta smallint, opciones smallint NOT NULL CHECK (opciones BETWEEN 2 AND 3),
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

-- 02-catalogo
-- Generado desde el banco publicado; no modifica IDs ni opciones.

INSERT INTO suizamente_social.preguntas(id,tipo,tema,correcta,opciones) VALUES
('cena_vida','dilema','comida',NULL,2),
('tren_pueblo','dilema','transporte',NULL,2),
('vecino_ruido','dilema','casa',NULL,2),
('votar_mucho','dilema','cultura',NULL,2),
('domingo_monte','dilema','naturaleza',NULL,2),
('choco_queso','dilema','comida',NULL,2),
('nota_vecino','dilema','casa',NULL,2),
('fronterizo','dilema','trabajo',NULL,2),
('esqui_tarde','dilema','naturaleza',NULL,2),
('lavanderia','dilema','casa',NULL,2),
('vaca_cisne','dilema','naturaleza',NULL,2),
('puntualidad','dilema','social',NULL,2),
('dialecto','dilema','idioma',NULL,2),
('domingo_tiendas','dilema','casa',NULL,2),
('niebla_wifi','dilema','naturaleza',NULL,2),
('herejia','dilema','comida',NULL,2),
('billete_1000','dilema','dinero',NULL,2),
('1_agosto','dilema','fiestas',NULL,2),
('bandera','dilema','cultura',NULL,2),
('bici_tren','dilema','transporte',NULL,2),
('yodel','dilema','cultura',NULL,2),
('alquilar','dilema','casa',NULL,2),
('zopf_gipfeli','dilema','comida',NULL,2),
('cervino','dilema','naturaleza',NULL,2),
('du_sie','dilema','trabajo',NULL,2),
('aleman_frances','dilema','idioma',NULL,3),
('osos_cabras','dilema','naturaleza',NULL,2),
('reloj_viaje','dilema','dinero',NULL,2),
('agua_fuente','dilema','casa',NULL,2),
('rosti_desayuno','dilema','comida',NULL,2),
('apero_cena','dilema','social',NULL,2),
('jass_coro','dilema','social',NULL,2),
('sauna_lago','dilema','social',NULL,2),
('tren_coche','dilema','transporte',NULL,2),
('verein','dilema','social',NULL,2),
('invierno_verano','dilema','naturaleza',NULL,2),
('carta_email','dilema','papeles',NULL,2),
('chocolate_tipo','dilema','comida',NULL,2),
('montana_lago','dilema','naturaleza',NULL,2),
('compra_frontera','dilema','dinero',NULL,2),
('septante','dilema','idioma',NULL,2),
('fasnacht_elige','dilema','fiestas',NULL,2),
('cabana_hotel','dilema','naturaleza',NULL,2),
('tren_perdido','dilema','transporte',NULL,2),
('regalo_casa','dilema','social',NULL,3),
('ventilar','dilema','casa',NULL,2),
('badi_rio','dilema','naturaleza',NULL,2),
('palabra_suiza','dilema','idioma',NULL,3),
('cervelat_raclette','dilema','comida',NULL,2),
('idioma_extra','dilema','idioma',NULL,3),
('d_bht7jh','dilema','casa',NULL,2),
('d_15264ie','dilema','casa',NULL,2),
('d_b0jljp','dilema','casa',NULL,3),
('d_8gdova','dilema','casa',NULL,2),
('d_1mzop8i','dilema','casa',NULL,2),
('d_1yo8o65','dilema','casa',NULL,3),
('d_1crruz1','dilema','casa',NULL,2),
('d_fpe2sm','dilema','casa',NULL,2),
('d_8q83k0','dilema','casa',NULL,2),
('d_mgi2yb','dilema','casa',NULL,2),
('d_rbim0q','dilema','casa',NULL,2),
('d_oaeo7n','dilema','casa',NULL,2),
('d_1ijn2im','dilema','casa',NULL,2),
('d_199vdfc','dilema','casa',NULL,2),
('d_194e9dw','dilema','casa',NULL,2),
('d_3i3zi','dilema','casa',NULL,2),
('d_1byp06d','dilema','casa',NULL,2),
('d_12jvt0r','dilema','casa',NULL,2),
('d_1g7umkc','dilema','casa',NULL,2),
('d_111oslh','dilema','casa',NULL,2),
('d_l3ovk3','dilema','papeles',NULL,2),
('d_1imnd0h','dilema','papeles',NULL,2),
('d_1la8emu','dilema','papeles',NULL,2),
('d_1k1btm5','dilema','papeles',NULL,2),
('d_u3rvnd','dilema','papeles',NULL,2),
('d_1ued4sf','dilema','papeles',NULL,2),
('d_15v24mz','dilema','papeles',NULL,2),
('d_1eoueiv','dilema','papeles',NULL,3),
('d_3p0ggb','dilema','papeles',NULL,2),
('d_whpvak','dilema','papeles',NULL,2),
('d_109bmah','dilema','dinero',NULL,2),
('d_1i9st8f','dilema','dinero',NULL,3),
('d_1eo11q1','dilema','dinero',NULL,3),
('d_1aufp1w','dilema','dinero',NULL,3),
('d_rwi1m5','dilema','dinero',NULL,2),
('d_l1qdhz','dilema','dinero',NULL,2),
('d_q6ware','dilema','dinero',NULL,2),
('d_gdrzas','dilema','dinero',NULL,2),
('d_1l9tmo1','dilema','dinero',NULL,2),
('d_15dt3vw','dilema','dinero',NULL,2),
('d_ccwyxl','dilema','dinero',NULL,3),
('d_1xoc88c','dilema','dinero',NULL,2),
('d_sn31pv','dilema','dinero',NULL,2),
('d_gbo5x3','dilema','dinero',NULL,2),
('d_106t38','dilema','dinero',NULL,2),
('d_5hapc7','dilema','dinero',NULL,2),
('d_q1thav','dilema','dinero',NULL,2),
('d_1ll5y2c','dilema','salud',NULL,2),
('d_1vidti6','dilema','salud',NULL,3),
('d_1i9mld6','dilema','salud',NULL,3),
('d_192vl59','dilema','salud',NULL,2),
('d_1bv25g5','dilema','salud',NULL,2),
('d_197o90t','dilema','salud',NULL,2),
('d_ea11w8','dilema','salud',NULL,2),
('d_11clxxe','dilema','salud',NULL,2),
('d_1ohgog4','dilema','salud',NULL,3),
('d_c7fn0g','dilema','salud',NULL,2),
('d_1ev3wn3','dilema','salud',NULL,2),
('d_1ukx77w','dilema','salud',NULL,2),
('d_1uv36b1','dilema','trabajo',NULL,2),
('d_1qp5an2','dilema','trabajo',NULL,2),
('d_1xy3qck','dilema','trabajo',NULL,2),
('d_n03bd0','dilema','trabajo',NULL,2),
('d_l3jf66','dilema','trabajo',NULL,3),
('d_1dfaom4','dilema','trabajo',NULL,2),
('d_1om5eew','dilema','trabajo',NULL,2),
('d_km84t','dilema','trabajo',NULL,2),
('d_1tuhzlg','dilema','trabajo',NULL,2),
('d_1un0emm','dilema','trabajo',NULL,2),
('d_1j4hz7w','dilema','trabajo',NULL,2),
('d_7yxg2y','dilema','trabajo',NULL,2),
('d_1q6z2wm','dilema','trabajo',NULL,3),
('d_kvif2p','dilema','trabajo',NULL,2),
('d_ok2jtf','dilema','trabajo',NULL,2),
('d_nnmkop','dilema','trabajo',NULL,2),
('d_100fp6w','dilema','trabajo',NULL,3),
('d_lvr993','dilema','trabajo',NULL,2),
('d_ijp5t2','dilema','trabajo',NULL,2),
('d_15mgne3','dilema','trabajo',NULL,2),
('d_zdd8pp','dilema','transporte',NULL,2),
('d_3yiw0t','dilema','transporte',NULL,2),
('d_143dtim','dilema','transporte',NULL,2),
('d_myrqqf','dilema','transporte',NULL,2),
('d_1tnwurt','dilema','transporte',NULL,3),
('d_1as5fwg','dilema','transporte',NULL,2),
('d_1xvk5fn','dilema','transporte',NULL,2),
('d_8vvzso','dilema','transporte',NULL,2),
('d_2i9a0d','dilema','transporte',NULL,2),
('d_189wvuo','dilema','transporte',NULL,3),
('d_pvicta','dilema','transporte',NULL,3),
('d_1dcqlli','dilema','transporte',NULL,2),
('d_5mhzt6','dilema','transporte',NULL,3),
('d_1b03ubb','dilema','transporte',NULL,2),
('d_1gx79u4','dilema','transporte',NULL,2),
('d_fx9p1p','dilema','transporte',NULL,2),
('d_1rh43qr','dilema','transporte',NULL,2),
('d_1rp9ykv','dilema','transporte',NULL,2),
('d_16mvzjh','dilema','transporte',NULL,2),
('d_1m79lau','dilema','social',NULL,2),
('d_qi7r84','dilema','social',NULL,2),
('d_1ofe184','dilema','social',NULL,3),
('d_1xyjpdk','dilema','social',NULL,2),
('d_1sirej0','dilema','social',NULL,2),
('d_14w5a4t','dilema','social',NULL,2),
('d_1rwvmn9','dilema','social',NULL,2),
('d_1d5aruo','dilema','social',NULL,2),
('d_1pbr4zk','dilema','social',NULL,3),
('d_1wbx6z','dilema','social',NULL,2),
('d_dgazey','dilema','social',NULL,3),
('d_6m6cwa','dilema','social',NULL,3),
('d_14yfm8v','dilema','social',NULL,2),
('d_1icmhyv','dilema','social',NULL,2),
('d_erhpmr','dilema','social',NULL,2),
('d_17erx99','dilema','social',NULL,2),
('d_16qqefy','dilema','social',NULL,2),
('d_3m288b','dilema','social',NULL,3),
('d_2fcdo','dilema','social',NULL,2),
('d_nskn6l','dilema','social',NULL,2),
('d_16ws8yc','dilema','comida',NULL,2),
('d_1g8qscr','dilema','comida',NULL,3),
('d_cdp26g','dilema','comida',NULL,3),
('d_nk7sj3','dilema','comida',NULL,3),
('d_1sannu0','dilema','comida',NULL,3),
('d_15but6m','dilema','comida',NULL,3),
('d_1yj6z8c','dilema','comida',NULL,3),
('d_ese9h7','dilema','comida',NULL,3),
('d_18zuz8b','dilema','comida',NULL,2),
('d_1138wx8','dilema','comida',NULL,3),
('d_15yv2d0','dilema','comida',NULL,3),
('d_1hru92p','dilema','comida',NULL,3),
('d_2r9pv1','dilema','comida',NULL,2),
('d_1dtc2ja','dilema','comida',NULL,3),
('d_11bbabd','dilema','comida',NULL,2),
('d_109l82v','dilema','comida',NULL,2),
('d_4wnxv','dilema','comida',NULL,3),
('d_12cn5sg','dilema','comida',NULL,2),
('d_1f4emie','dilema','comida',NULL,2),
('d_5ca3k','dilema','fiestas',NULL,2),
('d_1s9f9da','dilema','fiestas',NULL,2),
('d_1jy60w4','dilema','fiestas',NULL,2),
('d_gsh22b','dilema','fiestas',NULL,3),
('d_1uspw8u','dilema','fiestas',NULL,2),
('d_1tkr6m1','dilema','fiestas',NULL,2),
('d_gcimt5','dilema','fiestas',NULL,3),
('d_1giohi6','dilema','fiestas',NULL,3),
('d_1boyork','dilema','fiestas',NULL,2),
('d_13bak0l','dilema','fiestas',NULL,3),
('d_j07mgg','dilema','fiestas',NULL,2),
('d_bq8eog','dilema','fiestas',NULL,3),
('d_1u93dw6','dilema','fiestas',NULL,2),
('d_7oogct','dilema','fiestas',NULL,2),
('d_fnozy','dilema','naturaleza',NULL,2),
('d_1toqfcz','dilema','naturaleza',NULL,2),
('d_bt8afu','dilema','naturaleza',NULL,3),
('d_gba1np','dilema','naturaleza',NULL,2),
('d_82b4y4','dilema','naturaleza',NULL,2),
('d_1nl5z8u','dilema','naturaleza',NULL,3),
('d_ein0l6','dilema','naturaleza',NULL,3),
('d_1szmiaf','dilema','naturaleza',NULL,3),
('d_wotzdr','dilema','naturaleza',NULL,3),
('d_ae77n3','dilema','naturaleza',NULL,2),
('d_nbrwam','dilema','naturaleza',NULL,2),
('d_1218w4w','dilema','naturaleza',NULL,2),
('d_ruqsw8','dilema','naturaleza',NULL,2),
('d_ll82yy','dilema','naturaleza',NULL,2),
('d_a0qk9y','dilema','idioma',NULL,2),
('d_5bc5x2','dilema','idioma',NULL,2),
('d_acf71d','dilema','idioma',NULL,3),
('d_srisg9','dilema','idioma',NULL,3),
('d_1n1wtpn','dilema','idioma',NULL,2),
('d_3bzlyi','dilema','idioma',NULL,2),
('d_199hlyq','dilema','idioma',NULL,3),
('d_pbli2g','dilema','idioma',NULL,2),
('d_1gxdz67','dilema','idioma',NULL,3),
('d_19gtd9l','dilema','idioma',NULL,3),
('d_2qgevc','dilema','cultura',NULL,2),
('d_8swrer','dilema','cultura',NULL,3),
('d_dnvbgw','dilema','cultura',NULL,3),
('d_3qf9ms','dilema','cultura',NULL,3),
('d_1x2jlvs','dilema','cultura',NULL,3),
('d_1jodtqo','dilema','cultura',NULL,2),
('d_umngyg','dilema','cultura',NULL,3),
('d_jann7x','dilema','cultura',NULL,3),
('d_1vqx8eh','dilema','cultura',NULL,2),
('d_1189uvh','dilema','cultura',NULL,2),
('par_1whuryb','dilema','comida',NULL,2),
('par_1u9defi','dilema','cultura',NULL,2),
('par_1f5osbo','dilema','naturaleza',NULL,2),
('par_1njvl3t','dilema','fiestas',NULL,2),
('par_4oeb02','dilema','social',NULL,2),
('par_e97nyo','dilema','idioma',NULL,2),
('par_slfmpt','dilema','cultura',NULL,2),
('par_whcx20','dilema','cultura',NULL,2),
('par_1228p1c','dilema','comida',NULL,2),
('par_1yxsxbd','dilema','cultura',NULL,2),
('par_18a37tr','dilema','naturaleza',NULL,2),
('par_q1gl9s','dilema','fiestas',NULL,2),
('par_1gs6wcc','dilema','social',NULL,2),
('par_kfkm95','dilema','idioma',NULL,2),
('par_v0gln','dilema','cultura',NULL,2),
('par_4ajogb','dilema','cultura',NULL,2),
('par_1gk44k1','dilema','comida',NULL,2),
('par_nzjsst','dilema','cultura',NULL,2),
('par_1mic1ay','dilema','naturaleza',NULL,2),
('par_ufrd98','dilema','fiestas',NULL,2),
('par_1kyejbg','dilema','social',NULL,2),
('par_4pz0cg','dilema','idioma',NULL,2),
('par_1enhief','dilema','cultura',NULL,2),
('par_10au14q','dilema','cultura',NULL,2),
('par_huanvv','dilema','comida',NULL,2),
('par_dc9e2','dilema','cultura',NULL,2),
('par_6jirul','dilema','naturaleza',NULL,2),
('par_1a7fxtb','dilema','fiestas',NULL,2),
('par_xyx40f','dilema','social',NULL,2),
('par_1073xwz','dilema','idioma',NULL,2),
('par_1x7z8pl','dilema','cultura',NULL,2),
('par_igdxua','dilema','cultura',NULL,2),
('par_1eqci4k','dilema','comida',NULL,2),
('par_k5pwpl','dilema','cultura',NULL,2),
('par_1txlncb','dilema','naturaleza',NULL,2),
('par_dyw7qv','dilema','fiestas',NULL,2),
('par_2vig6y','dilema','social',NULL,2),
('par_70a236','dilema','idioma',NULL,2),
('par_1iit74s','dilema','cultura',NULL,2),
('par_y9q83e','dilema','cultura',NULL,2),
('par_1kyjezf','dilema','comida',NULL,2),
('par_yrsxvl','dilema','cultura',NULL,2),
('par_mn4nsi','dilema','naturaleza',NULL,2),
('par_1fgruo7','dilema','fiestas',NULL,2),
('par_rvojim','dilema','social',NULL,2),
('par_umh70y','dilema','idioma',NULL,2),
('par_1rbl3lb','dilema','cultura',NULL,2),
('par_1dxonw6','dilema','cultura',NULL,2),
('par_bfku0c','dilema','comida',NULL,2),
('par_68mndk','dilema','cultura',NULL,2),
('par_8q3s8e','dilema','naturaleza',NULL,2),
('par_1bw00se','dilema','fiestas',NULL,2),
('par_c5y02q','dilema','social',NULL,2),
('par_4emkdu','dilema','idioma',NULL,2),
('par_4val22','dilema','cultura',NULL,2),
('par_b6bha2','dilema','cultura',NULL,2),
('par_70zfx1','dilema','comida',NULL,2),
('par_81k8cy','dilema','cultura',NULL,2),
('par_tant98','dilema','naturaleza',NULL,2),
('par_lo7rjy','dilema','fiestas',NULL,2),
('par_1i6ig31','dilema','social',NULL,2),
('par_57e38g','dilema','idioma',NULL,2),
('par_qo7jvk','dilema','cultura',NULL,2),
('par_1p3zfaf','dilema','cultura',NULL,2),
('par_1kxky7x','dilema','comida',NULL,2),
('par_1iaja06','dilema','cultura',NULL,2),
('par_tewfip','dilema','naturaleza',NULL,2),
('par_1f9feea','dilema','fiestas',NULL,2),
('par_lm6fmy','dilema','social',NULL,2),
('par_27m5n7','dilema','idioma',NULL,2),
('par_11oc2mc','dilema','cultura',NULL,2),
('par_vjuahz','dilema','cultura',NULL,2),
('par_163pbzx','dilema','comida',NULL,2),
('par_1ull610','dilema','cultura',NULL,2),
('par_cbjnll','dilema','naturaleza',NULL,2),
('par_1nvyn2w','dilema','fiestas',NULL,2),
('par_171b7o','dilema','social',NULL,2),
('par_eu0y2d','dilema','idioma',NULL,2),
('par_130z05o','dilema','cultura',NULL,2),
('par_10jlt1v','dilema','cultura',NULL,2),
('par_ww6pok','dilema','comida',NULL,2),
('par_49fp4x','dilema','cultura',NULL,2),
('par_c65xvh','dilema','naturaleza',NULL,2),
('par_1jxr5g5','dilema','fiestas',NULL,2),
('par_1nez1w0','dilema','social',NULL,2),
('par_1taq0yh','dilema','idioma',NULL,2),
('par_1onuxa0','dilema','cultura',NULL,2),
('par_vhns75','dilema','cultura',NULL,2),
('par_q06xz5','dilema','comida',NULL,2),
('par_1nni66l','dilema','cultura',NULL,2),
('par_7f9v3z','dilema','naturaleza',NULL,2),
('par_sqocsk','dilema','fiestas',NULL,2),
('par_le2wlv','dilema','social',NULL,2),
('par_hayl2g','dilema','idioma',NULL,2),
('par_1t8mqvr','dilema','cultura',NULL,2),
('par_j09v1d','dilema','cultura',NULL,2),
('par_fg2y0u','dilema','comida',NULL,2),
('par_1625sdu','dilema','cultura',NULL,2),
('par_1q2dqkp','dilema','naturaleza',NULL,2),
('par_1qernbt','dilema','fiestas',NULL,2),
('par_to7vas','dilema','social',NULL,2),
('par_14gt36z','dilema','idioma',NULL,2),
('par_72f6u0','dilema','cultura',NULL,2),
('par_z5jloj','dilema','cultura',NULL,2),
('par_x9d3lf','dilema','comida',NULL,2),
('par_1p5v2xr','dilema','cultura',NULL,2),
('par_e6jbj9','dilema','naturaleza',NULL,2),
('par_5tphhu','dilema','fiestas',NULL,2),
('par_1yfbnkx','dilema','social',NULL,2),
('par_16ekmlb','dilema','idioma',NULL,2),
('par_vzu91j','dilema','cultura',NULL,2),
('par_ofbl5f','dilema','cultura',NULL,2),
('par_lyb1hx','dilema','comida',NULL,2),
('par_b60jd','dilema','cultura',NULL,2),
('par_1l7yc39','dilema','naturaleza',NULL,2),
('par_sobnxz','dilema','fiestas',NULL,2),
('par_v4szic','dilema','social',NULL,2),
('par_1r7tlr2','dilema','idioma',NULL,2),
('par_1scfaoj','dilema','cultura',NULL,2),
('par_lluy7t','dilema','cultura',NULL,2),
('par_wokov8','dilema','comida',NULL,2),
('par_pc4r8m','dilema','cultura',NULL,2),
('par_1aiyjc7','dilema','naturaleza',NULL,2),
('par_p6xsxa','dilema','fiestas',NULL,2),
('par_1pxxslq','dilema','social',NULL,2),
('par_11r46p9','dilema','idioma',NULL,2),
('par_182w52n','dilema','cultura',NULL,2),
('par_6qfhjn','dilema','cultura',NULL,2),
('par_1npoui9','dilema','comida',NULL,2),
('par_6yqa1g','dilema','cultura',NULL,2),
('par_19sg7em','dilema','naturaleza',NULL,2),
('par_u77rd6','dilema','fiestas',NULL,2),
('par_1ub4h1h','dilema','social',NULL,2),
('par_13lveh9','dilema','idioma',NULL,2),
('par_3d2tmj','dilema','cultura',NULL,2),
('par_ip2j7u','dilema','cultura',NULL,2),
('par_1fsjwcw','dilema','comida',NULL,2),
('par_1wooqxs','dilema','cultura',NULL,2),
('par_270thq','dilema','naturaleza',NULL,2),
('par_gkv9kj','dilema','fiestas',NULL,2),
('par_1krbl8w','dilema','social',NULL,2),
('par_189dnzm','dilema','idioma',NULL,2),
('par_b06dqq','dilema','cultura',NULL,2),
('par_1745wyy','dilema','cultura',NULL,2),
('par_8iy5tl','dilema','comida',NULL,2),
('par_v7xvfx','dilema','cultura',NULL,2),
('par_wpq8kg','dilema','naturaleza',NULL,2),
('par_oulppl','dilema','fiestas',NULL,2),
('par_i4yody','dilema','social',NULL,2),
('par_1jpsxth','dilema','idioma',NULL,2),
('par_16yk2cn','dilema','cultura',NULL,2),
('par_xf5hvk','dilema','cultura',NULL,2),
('par_1tad078','dilema','comida',NULL,2),
('par_wvnot6','dilema','cultura',NULL,2),
('par_x16ifz','dilema','naturaleza',NULL,2),
('par_69nkp7','dilema','fiestas',NULL,2),
('par_1n6gxsa','dilema','social',NULL,2),
('par_exxgw8','dilema','idioma',NULL,2),
('par_xjjlgx','dilema','cultura',NULL,2),
('par_5qawas','dilema','cultura',NULL,2),
('par_vmj4o2','dilema','comida',NULL,2),
('par_1v9oj86','dilema','cultura',NULL,2),
('par_1tnfl74','dilema','naturaleza',NULL,2),
('par_10rncaf','dilema','fiestas',NULL,2),
('par_1p3dv5l','dilema','social',NULL,2),
('par_yynu8b','dilema','idioma',NULL,2),
('par_4xxm0','dilema','cultura',NULL,2),
('par_1k7ijp7','dilema','cultura',NULL,2),
('par_1t1jf3e','dilema','comida',NULL,2),
('par_19k6qee','dilema','cultura',NULL,2),
('par_1vmxriz','dilema','naturaleza',NULL,2),
('par_35ippm','dilema','fiestas',NULL,2),
('par_yak0km','dilema','social',NULL,2),
('par_17vr5b','dilema','idioma',NULL,2),
('par_1r1e5uy','dilema','cultura',NULL,2),
('par_f561ns','dilema','cultura',NULL,2),
('par_xky1z6','dilema','comida',NULL,2),
('par_ep8j1o','dilema','cultura',NULL,2),
('par_1tc4hpm','dilema','naturaleza',NULL,2),
('par_12vffsp','dilema','fiestas',NULL,2),
('par_ws3zgm','dilema','social',NULL,2),
('par_3y5te4','dilema','idioma',NULL,2),
('par_1n23tc0','dilema','cultura',NULL,2),
('par_1y2tqqg','dilema','cultura',NULL,2),
('par_85frhi','dilema','comida',NULL,2),
('par_1ldu67f','dilema','cultura',NULL,2),
('par_36pnzg','dilema','naturaleza',NULL,2),
('par_92i0x7','dilema','fiestas',NULL,2),
('par_zp9zco','dilema','social',NULL,2),
('par_22vu43','dilema','idioma',NULL,2),
('par_1umjjl9','dilema','cultura',NULL,2),
('par_cwb1tw','dilema','cultura',NULL,2),
('par_1y4edhq','dilema','comida',NULL,2),
('par_mdex3t','dilema','cultura',NULL,2),
('par_1hcf36r','dilema','naturaleza',NULL,2),
('par_1wy22gs','dilema','fiestas',NULL,2),
('par_110ngxo','dilema','social',NULL,2),
('par_3poe9b','dilema','idioma',NULL,2),
('par_irxfwb','dilema','cultura',NULL,2),
('par_plypqw','dilema','cultura',NULL,2),
('par_193jrr4','dilema','comida',NULL,2),
('par_1a97zwi','dilema','cultura',NULL,2),
('par_fic9v6','dilema','naturaleza',NULL,2),
('par_1sbmskb','dilema','fiestas',NULL,2),
('par_1q1soge','dilema','social',NULL,2),
('par_i93d5d','dilema','idioma',NULL,2),
('par_11p1rd1','dilema','cultura',NULL,2),
('par_l9k7zk','dilema','cultura',NULL,2),
('par_qwkos4','dilema','comida',NULL,2),
('par_ptkg43','dilema','cultura',NULL,2),
('par_pbtzyu','dilema','naturaleza',NULL,2),
('par_1lj2e8a','dilema','fiestas',NULL,2),
('par_1i0xl6e','dilema','social',NULL,2),
('par_565pd3','dilema','idioma',NULL,2),
('par_qnoswq','dilema','cultura',NULL,2),
('par_6y12yu','dilema','cultura',NULL,2),
('par_17zv6ys','dilema','comida',NULL,2),
('par_1iq46ld','dilema','cultura',NULL,2),
('par_2yvzgj','dilema','naturaleza',NULL,2),
('par_3ptmo2','dilema','fiestas',NULL,2),
('par_1o0z3pl','dilema','social',NULL,2),
('par_kptnm7','dilema','idioma',NULL,2),
('par_azrjms','dilema','cultura',NULL,2),
('par_29um25','dilema','cultura',NULL,2),
('par_1ik3lw0','dilema','comida',NULL,2),
('par_1xg4n5w','dilema','cultura',NULL,2),
('par_nis5gt','dilema','naturaleza',NULL,2),
('par_1er1uu3','dilema','fiestas',NULL,2),
('par_cmyfz5','dilema','social',NULL,2),
('par_7vesav','dilema','idioma',NULL,2),
('par_rk5bqo','dilema','cultura',NULL,2),
('par_1x5iey7','dilema','cultura',NULL,2),
('par_rzh22w','dilema','comida',NULL,2),
('par_5oebcz','dilema','cultura',NULL,2),
('par_u51xbf','dilema','naturaleza',NULL,2),
('par_18y2gi0','dilema','fiestas',NULL,2),
('par_lcoak0','dilema','social',NULL,2),
('par_42wgo0','dilema','idioma',NULL,2),
('par_x8afdo','dilema','cultura',NULL,2),
('par_1navmg3','dilema','cultura',NULL,2),
('par_883su5','dilema','comida',NULL,2),
('par_9p6i77','dilema','cultura',NULL,2),
('par_1ppo3ru','dilema','naturaleza',NULL,2),
('par_1de54oo','dilema','fiestas',NULL,2),
('par_121k94c','dilema','social',NULL,2),
('par_3e11lk','dilema','idioma',NULL,2),
('par_18fo1nv','dilema','cultura',NULL,2),
('par_16uqd7s','dilema','cultura',NULL,2),
('par_12pmwii','dilema','comida',NULL,2),
('par_lgti6y','dilema','cultura',NULL,2),
('par_mpfi0h','dilema','naturaleza',NULL,2),
('par_1k0beli','dilema','fiestas',NULL,2),
('par_tubx47','dilema','social',NULL,2),
('par_6qo7u2','dilema','idioma',NULL,2),
('par_t4orpd','dilema','cultura',NULL,2),
('par_1mszea8','dilema','cultura',NULL,2),
('par_wxi5on','dilema','comida',NULL,2),
('par_fehqzf','dilema','cultura',NULL,2),
('par_v7u53m','dilema','naturaleza',NULL,2),
('par_v16hmb','dilema','fiestas',NULL,2),
('par_zkjkuz','dilema','social',NULL,2),
('par_28oyez','dilema','idioma',NULL,2),
('par_hadvvt','dilema','cultura',NULL,2),
('par_1fmg5g4','dilema','cultura',NULL,2),
('par_jg5ytv','dilema','comida',NULL,2),
('par_qam1m8','dilema','cultura',NULL,2),
('par_w6ctto','dilema','naturaleza',NULL,2),
('par_lovant','dilema','fiestas',NULL,2),
('par_12ed2sk','dilema','social',NULL,2),
('par_uvs5x6','dilema','idioma',NULL,2),
('par_fnlnrq','dilema','cultura',NULL,2),
('par_giiqjn','dilema','cultura',NULL,2),
('par_9t72j5','dilema','comida',NULL,2),
('par_4n2vjq','dilema','cultura',NULL,2),
('par_g5d723','dilema','naturaleza',NULL,2),
('par_4sabgl','dilema','fiestas',NULL,2),
('par_wa5qim','dilema','social',NULL,2),
('par_i8wh5g','dilema','idioma',NULL,2),
('par_19ma8ae','dilema','cultura',NULL,2),
('par_ry02yc','dilema','cultura',NULL,2),
('par_18equuk','dilema','comida',NULL,2),
('par_1w9zeee','dilema','cultura',NULL,2),
('par_21r35g','dilema','naturaleza',NULL,2),
('par_1h1r3bp','dilema','fiestas',NULL,2),
('par_1ws9q6d','dilema','social',NULL,2),
('par_txsken','dilema','idioma',NULL,2),
('par_ynyeg0','dilema','cultura',NULL,2),
('par_1357pbt','dilema','cultura',NULL,2),
('par_1wthaft','dilema','comida',NULL,2),
('par_bgppkx','dilema','cultura',NULL,2),
('par_ktqaq4','dilema','naturaleza',NULL,2),
('par_1mqs87n','dilema','fiestas',NULL,2),
('par_10yt495','dilema','social',NULL,2),
('par_1d36q17','dilema','idioma',NULL,2),
('par_d9p90r','dilema','cultura',NULL,2),
('par_5g71ff','dilema','cultura',NULL,2),
('par_1eits59','dilema','comida',NULL,2),
('par_1diz22i','dilema','cultura',NULL,2),
('par_xa5qas','dilema','naturaleza',NULL,2),
('par_lllbu5','dilema','fiestas',NULL,2),
('par_qwpzr1','dilema','social',NULL,2),
('par_1tgh384','dilema','idioma',NULL,2),
('par_1sc5h5j','dilema','cultura',NULL,2),
('par_2pcer7','dilema','cultura',NULL,2),
('par_9rx6yf','dilema','comida',NULL,2),
('par_1xkcten','dilema','cultura',NULL,2),
('par_pdby56','dilema','naturaleza',NULL,2),
('par_12ch1fi','dilema','fiestas',NULL,2),
('par_agr5md','dilema','social',NULL,2),
('par_cm210x','dilema','idioma',NULL,2),
('par_18azlk2','dilema','cultura',NULL,2),
('par_1dlmvmr','dilema','cultura',NULL,2),
('par_1pt4nbd','dilema','comida',NULL,2),
('par_41vxoh','dilema','cultura',NULL,2),
('par_wduzb4','dilema','naturaleza',NULL,2),
('par_51q6qj','dilema','fiestas',NULL,2),
('par_1vjkupo','dilema','social',NULL,2),
('par_1y75611','dilema','idioma',NULL,2),
('par_yhd3aw','dilema','cultura',NULL,2),
('par_up2dvx','dilema','cultura',NULL,2),
('par_zfvwe8','dilema','comida',NULL,2),
('par_6h9fr4','dilema','cultura',NULL,2),
('par_prayfs','dilema','naturaleza',NULL,2),
('par_fp721w','dilema','fiestas',NULL,2),
('par_18idb6d','dilema','social',NULL,2),
('par_1a6x2pd','dilema','cultura',NULL,2),
('par_1o7p5z6','dilema','comida',NULL,2),
('par_1qx9s4t','dilema','cultura',NULL,2),
('par_1qb2f12','dilema','naturaleza',NULL,2),
('par_kovo66','dilema','fiestas',NULL,2),
('par_1altzcf','dilema','social',NULL,2),
('par_1ihh9v5','dilema','cultura',NULL,2),
('par_1g5cv2p','dilema','comida',NULL,2),
('par_1qhoc9w','dilema','cultura',NULL,2),
('par_19zkafp','dilema','naturaleza',NULL,2),
('par_1a7dit4','dilema','fiestas',NULL,2),
('par_a0qj16','dilema','social',NULL,2),
('par_a5dqlg','dilema','cultura',NULL,2),
('par_18aplw9','dilema','comida',NULL,2),
('par_1760600','dilema','cultura',NULL,2),
('par_1pdr86k','dilema','naturaleza',NULL,2),
('par_vjgzll','dilema','fiestas',NULL,2),
('par_1x6wlug','dilema','social',NULL,2),
('par_xi5m2w','dilema','cultura',NULL,2),
('par_y8ctc9','dilema','comida',NULL,2),
('par_sgjkxt','dilema','cultura',NULL,2),
('par_3ki6hg','dilema','naturaleza',NULL,2),
('par_1d7yfdh','dilema','fiestas',NULL,2),
('par_gx57r','dilema','social',NULL,2),
('par_fg4gcx','dilema','cultura',NULL,2),
('par_4kbqyn','dilema','comida',NULL,2),
('par_qvn6zh','dilema','cultura',NULL,2),
('par_19in3tv','dilema','naturaleza',NULL,2),
('par_113qe36','dilema','fiestas',NULL,2),
('par_ssa88j','dilema','social',NULL,2),
('par_1c2dmkd','dilema','cultura',NULL,2),
('par_2svxaa','dilema','comida',NULL,2),
('par_1kd3cms','dilema','cultura',NULL,2),
('par_1c6bgmz','dilema','naturaleza',NULL,2),
('par_ccsm7','dilema','fiestas',NULL,2),
('par_11hvhri','dilema','social',NULL,2),
('par_1s9e7pe','dilema','cultura',NULL,2),
('par_otzq53','dilema','comida',NULL,2),
('par_nahjlc','dilema','cultura',NULL,2),
('par_18xdrvt','dilema','naturaleza',NULL,2),
('par_1kpezb9','dilema','fiestas',NULL,2),
('par_skq6fo','dilema','social',NULL,2),
('par_gc1d34','dilema','cultura',NULL,2),
('par_2yn1z','dilema','comida',NULL,2),
('par_1qvs90e','dilema','cultura',NULL,2),
('par_1ph6w8l','dilema','naturaleza',NULL,2),
('par_mvcnhy','dilema','fiestas',NULL,2),
('par_cot7oe','dilema','social',NULL,2),
('par_1cz1694','dilema','cultura',NULL,2),
('par_1xoxwzz','dilema','comida',NULL,2),
('par_14n2urj','dilema','cultura',NULL,2),
('par_133haxe','dilema','naturaleza',NULL,2),
('par_ecfrrz','dilema','fiestas',NULL,2),
('par_12efi54','dilema','social',NULL,2),
('par_1llbi8v','dilema','cultura',NULL,2),
('par_1wcsiyh','dilema','comida',NULL,2),
('par_1ngq4mq','dilema','cultura',NULL,2),
('par_4fsv2j','dilema','naturaleza',NULL,2),
('par_vjbpz0','dilema','fiestas',NULL,2),
('par_gappge','dilema','social',NULL,2),
('par_j27uut','dilema','cultura',NULL,2),
('par_1nrsm8f','dilema','comida',NULL,2),
('par_2kvvjn','dilema','cultura',NULL,2),
('par_bsjrk5','dilema','naturaleza',NULL,2),
('par_lckxk3','dilema','fiestas',NULL,2),
('par_1248gl3','dilema','social',NULL,2),
('par_sitvrg','dilema','cultura',NULL,2),
('par_187g7r6','dilema','comida',NULL,2),
('par_fadqhh','dilema','cultura',NULL,2),
('par_2v0ibw','dilema','naturaleza',NULL,2),
('par_17zm8mq','dilema','fiestas',NULL,2),
('par_n6yts7','dilema','social',NULL,2),
('par_1p3mlxy','dilema','cultura',NULL,2),
('par_1r89204','dilema','comida',NULL,2),
('par_7tbq5d','dilema','cultura',NULL,2),
('par_1nl96hu','dilema','naturaleza',NULL,2),
('par_msgi04','dilema','fiestas',NULL,2),
('par_1b7s0bv','dilema','social',NULL,2),
('par_1706hyr','dilema','cultura',NULL,2),
('par_s32ses','dilema','comida',NULL,2),
('par_xhhtw6','dilema','cultura',NULL,2),
('par_uoo59l','dilema','naturaleza',NULL,2),
('par_17b3t97','dilema','fiestas',NULL,2),
('par_92bxha','dilema','social',NULL,2),
('par_139v2pr','dilema','cultura',NULL,2),
('par_1qvxrf8','dilema','comida',NULL,2),
('par_e9qc0i','dilema','cultura',NULL,2),
('par_15kt2o8','dilema','naturaleza',NULL,2),
('par_e4zbfd','dilema','fiestas',NULL,2),
('par_wrqvzt','dilema','social',NULL,2),
('par_1s5negg','dilema','cultura',NULL,2),
('par_10elwi4','dilema','comida',NULL,2),
('par_nvh7li','dilema','cultura',NULL,2),
('par_ns66hw','dilema','naturaleza',NULL,2),
('par_1clomry','dilema','fiestas',NULL,2),
('par_6stqi1','dilema','social',NULL,2),
('par_1xa5c5u','dilema','cultura',NULL,2),
('par_1kwcywa','dilema','comida',NULL,2),
('par_10cfxq0','dilema','cultura',NULL,2),
('par_395wgc','dilema','naturaleza',NULL,2),
('par_1a5hfdd','dilema','fiestas',NULL,2),
('par_h18hjv','dilema','social',NULL,2),
('par_1lypl9u','dilema','cultura',NULL,2),
('par_10hzhsc','dilema','comida',NULL,2),
('par_4g725c','dilema','cultura',NULL,2),
('par_9s3vtd','dilema','naturaleza',NULL,2),
('par_1wi70ac','dilema','fiestas',NULL,2),
('par_j1zcwm','dilema','social',NULL,2),
('par_1r1gxh5','dilema','cultura',NULL,2),
('par_hhy6xs','dilema','comida',NULL,2),
('par_866izr','dilema','cultura',NULL,2),
('par_pnakc2','dilema','naturaleza',NULL,2),
('par_u7ikpn','dilema','fiestas',NULL,2),
('par_k9f4s7','dilema','social',NULL,2),
('par_u13liz','dilema','cultura',NULL,2),
('par_1h7en78','dilema','comida',NULL,2),
('par_fm79j2','dilema','cultura',NULL,2),
('par_mgtz8b','dilema','naturaleza',NULL,2),
('par_1fp0v3v','dilema','fiestas',NULL,2),
('par_zzrzl3','dilema','social',NULL,2),
('par_floa82','dilema','cultura',NULL,2),
('par_69hc6w','dilema','comida',NULL,2),
('par_1c1owae','dilema','cultura',NULL,2),
('par_1h9fuz8','dilema','naturaleza',NULL,2),
('par_11x542b','dilema','fiestas',NULL,2),
('par_17rr50w','dilema','social',NULL,2),
('par_uuv3v9','dilema','cultura',NULL,2),
('par_bc9hg5','dilema','comida',NULL,2),
('par_6uhkgj','dilema','cultura',NULL,2),
('par_jwnfed','dilema','naturaleza',NULL,2),
('par_1al07ls','dilema','fiestas',NULL,2),
('par_63bktz','dilema','social',NULL,2),
('par_10k86mt','dilema','cultura',NULL,2),
('par_riz4r9','dilema','comida',NULL,2),
('par_i9at2g','dilema','cultura',NULL,2),
('par_2lzz2z','dilema','naturaleza',NULL,2),
('par_7cypq9','dilema','fiestas',NULL,2),
('par_103xcfx','dilema','social',NULL,2),
('par_7sbzti','dilema','cultura',NULL,2),
('par_swyv4x','dilema','comida',NULL,2),
('par_1f8uzrk','dilema','cultura',NULL,2),
('par_yffqhv','dilema','naturaleza',NULL,2),
('par_y2f7zt','dilema','fiestas',NULL,2),
('par_19lo2i1','dilema','social',NULL,2),
('par_jvtayh','dilema','cultura',NULL,2),
('par_43k2pk','dilema','comida',NULL,2),
('par_ej11d8','dilema','cultura',NULL,2),
('par_paa6fv','dilema','naturaleza',NULL,2),
('par_r9qwvw','dilema','fiestas',NULL,2),
('par_tsv47b','dilema','social',NULL,2),
('par_ly2it','dilema','cultura',NULL,2),
('par_d1nobm','dilema','comida',NULL,2),
('par_atq47q','dilema','cultura',NULL,2),
('par_issqgp','dilema','naturaleza',NULL,2),
('par_cbfgfu','dilema','fiestas',NULL,2),
('par_4cp84z','dilema','social',NULL,2),
('par_1qz17na','dilema','cultura',NULL,2),
('par_1qf9vmk','dilema','comida',NULL,2),
('par_mxc1lk','dilema','cultura',NULL,2),
('par_j6j9yz','dilema','naturaleza',NULL,2),
('par_1kfw4ei','dilema','fiestas',NULL,2),
('par_osw5a0','dilema','social',NULL,2),
('par_801o6g','dilema','cultura',NULL,2),
('par_15uqbbi','dilema','comida',NULL,2),
('par_dhcx2j','dilema','cultura',NULL,2),
('par_vrkff8','dilema','naturaleza',NULL,2),
('par_17g3cd6','dilema','fiestas',NULL,2),
('par_1s7lajf','dilema','social',NULL,2),
('par_3hpqoj','dilema','cultura',NULL,2),
('par_d5zkr6','dilema','comida',NULL,2),
('par_1htfdd4','dilema','cultura',NULL,2),
('par_1etl7k1','dilema','naturaleza',NULL,2),
('par_vlgahe','dilema','fiestas',NULL,2),
('par_1hffp17','dilema','social',NULL,2),
('par_zg8xs9','dilema','cultura',NULL,2),
('par_njhqtd','dilema','comida',NULL,2),
('par_1wme53r','dilema','cultura',NULL,2),
('par_17oclgi','dilema','naturaleza',NULL,2),
('par_1swd1l0','dilema','fiestas',NULL,2),
('par_qkq3wr','dilema','social',NULL,2),
('par_xe7r44','dilema','cultura',NULL,2),
('par_1b1u98c','dilema','comida',NULL,2),
('par_wlg7ip','dilema','cultura',NULL,2),
('par_1mu9mrb','dilema','naturaleza',NULL,2),
('par_1wkxj8j','dilema','fiestas',NULL,2),
('par_m97il8','dilema','social',NULL,2),
('par_mp3djh','dilema','cultura',NULL,2),
('par_1jyo5z8','dilema','comida',NULL,2),
('par_vw0bzn','dilema','cultura',NULL,2),
('par_qg6lpj','dilema','naturaleza',NULL,2),
('par_fpxxlr','dilema','fiestas',NULL,2),
('par_13cfewa','dilema','social',NULL,2),
('par_bnkjo5','dilema','cultura',NULL,2),
('par_fetv0l','dilema','comida',NULL,2),
('par_1iscxey','dilema','cultura',NULL,2),
('par_a67x86','dilema','naturaleza',NULL,2),
('par_355wce','dilema','fiestas',NULL,2),
('par_1u91xdu','dilema','social',NULL,2),
('par_1stnvmq','dilema','cultura',NULL,2),
('par_kjnjae','dilema','comida',NULL,2),
('par_10n1gak','dilema','cultura',NULL,2),
('par_f9075z','dilema','naturaleza',NULL,2),
('par_1az2s5z','dilema','fiestas',NULL,2),
('par_1mqk0q2','dilema','social',NULL,2),
('par_196dokv','dilema','cultura',NULL,2),
('par_1f5jjps','dilema','comida',NULL,2),
('par_5axav1','dilema','cultura',NULL,2),
('par_yqpjrx','dilema','naturaleza',NULL,2),
('par_dpyt1u','dilema','fiestas',NULL,2),
('par_1qek5rz','dilema','social',NULL,2),
('par_hs9h7n','dilema','cultura',NULL,2),
('par_123216f','dilema','comida',NULL,2),
('par_m0hllu','dilema','cultura',NULL,2),
('par_70mkfd','dilema','naturaleza',NULL,2),
('par_2iv2sv','dilema','fiestas',NULL,2),
('par_v6x8xp','dilema','social',NULL,2),
('par_1busmyz','dilema','cultura',NULL,2),
('par_4ongky','dilema','comida',NULL,2),
('par_1a30n80','dilema','cultura',NULL,2),
('par_1h3lnyd','dilema','naturaleza',NULL,2),
('par_7qvmj3','dilema','fiestas',NULL,2),
('par_1vjlf6l','dilema','social',NULL,2),
('par_ty121b','dilema','cultura',NULL,2),
('par_rgejyw','dilema','comida',NULL,2),
('par_14vorwa','dilema','cultura',NULL,2),
('par_11adan','dilema','naturaleza',NULL,2),
('par_yzneye','dilema','fiestas',NULL,2),
('par_1hqp9bp','dilema','social',NULL,2),
('par_1je40bk','dilema','cultura',NULL,2),
('par_tu03si','dilema','comida',NULL,2),
('par_v950d9','dilema','cultura',NULL,2),
('par_lbkypk','dilema','naturaleza',NULL,2),
('par_1478o4o','dilema','fiestas',NULL,2),
('par_6073sj','dilema','social',NULL,2),
('par_12yw656','dilema','cultura',NULL,2),
('par_1cwnseg','dilema','comida',NULL,2),
('par_unc2x2','dilema','cultura',NULL,2),
('par_ikymth','dilema','naturaleza',NULL,2),
('par_1gt6fm8','dilema','fiestas',NULL,2),
('par_1rdjltj','dilema','social',NULL,2),
('par_pi9fry','dilema','cultura',NULL,2),
('par_1iv1h8d','dilema','comida',NULL,2),
('par_1l1yqf0','dilema','cultura',NULL,2),
('par_1vk9cn8','dilema','naturaleza',NULL,2),
('par_mkjq8s','dilema','fiestas',NULL,2),
('par_1395tsp','dilema','social',NULL,2),
('par_axvyk2','dilema','cultura',NULL,2),
('par_1i8bvws','dilema','comida',NULL,2),
('par_15jyuzv','dilema','cultura',NULL,2),
('par_197ajgv','dilema','naturaleza',NULL,2),
('par_1pzf6av','dilema','fiestas',NULL,2),
('par_1iy9nf5','dilema','social',NULL,2),
('par_5yna73','dilema','cultura',NULL,2),
('par_1wted5l','dilema','comida',NULL,2),
('par_1qj7lhb','dilema','cultura',NULL,2),
('par_nq83uw','dilema','naturaleza',NULL,2),
('par_jxi6tu','dilema','fiestas',NULL,2),
('par_6veddz','dilema','social',NULL,2),
('par_t5k53q','dilema','cultura',NULL,2),
('par_g3a9xf','dilema','comida',NULL,2),
('par_1sat22','dilema','cultura',NULL,2),
('par_18p3ap8','dilema','naturaleza',NULL,2),
('par_fax33k','dilema','fiestas',NULL,2),
('par_1fwefav','dilema','social',NULL,2),
('par_1moqrl','dilema','cultura',NULL,2),
('par_k8jfus','dilema','comida',NULL,2),
('par_l07ffs','dilema','cultura',NULL,2),
('par_13oxkhd','dilema','naturaleza',NULL,2),
('par_3ewm49','dilema','fiestas',NULL,2),
('par_1ezloqi','dilema','social',NULL,2),
('par_1p1chrd','dilema','cultura',NULL,2),
('par_67hoxa','dilema','comida',NULL,2),
('par_6s2jrj','dilema','cultura',NULL,2),
('par_19r3n4z','dilema','naturaleza',NULL,2),
('par_7uoi0i','dilema','fiestas',NULL,2),
('par_x8g79i','dilema','social',NULL,2),
('par_1p618dq','dilema','cultura',NULL,2),
('par_1bzbay2','dilema','comida',NULL,2),
('par_9uuzsk','dilema','cultura',NULL,2),
('par_nzhb5g','dilema','naturaleza',NULL,2),
('par_b20xh7','dilema','fiestas',NULL,2),
('par_1acta5d','dilema','social',NULL,2),
('par_w5ssi3','dilema','cultura',NULL,2),
('par_n9zgdi','dilema','comida',NULL,2),
('par_11ugy4v','dilema','cultura',NULL,2),
('par_188lwnp','dilema','naturaleza',NULL,2),
('par_rm8q7','dilema','fiestas',NULL,2),
('par_14512ug','dilema','social',NULL,2),
('par_1chi39d','dilema','cultura',NULL,2),
('par_cif6us','dilema','comida',NULL,2),
('par_s1jcjm','dilema','cultura',NULL,2),
('par_1o2s3ng','dilema','naturaleza',NULL,2),
('par_19h00pl','dilema','fiestas',NULL,2),
('par_xsixjn','dilema','social',NULL,2),
('par_102sk1k','dilema','cultura',NULL,2),
('par_1x5tjey','dilema','comida',NULL,2),
('par_3na50u','dilema','naturaleza',NULL,2),
('par_ms3c8s','dilema','fiestas',NULL,2),
('par_1dik0bj','dilema','social',NULL,2),
('par_14dnxug','dilema','comida',NULL,2),
('par_5wkaym','dilema','naturaleza',NULL,2),
('par_15oh3x2','dilema','fiestas',NULL,2),
('par_mhw21p','dilema','social',NULL,2),
('par_n2m53k','dilema','comida',NULL,2),
('par_11qrceu','dilema','naturaleza',NULL,2),
('par_acx2cn','dilema','fiestas',NULL,2),
('par_1omdo01','dilema','social',NULL,2),
('par_cow42s','dilema','comida',NULL,2),
('par_1sv9wzg','dilema','naturaleza',NULL,2),
('par_nvzvw5','dilema','fiestas',NULL,2),
('par_zbm523','dilema','social',NULL,2),
('par_enraez','dilema','comida',NULL,2),
('par_yhoitp','dilema','naturaleza',NULL,2),
('par_y5uthj','dilema','fiestas',NULL,2),
('par_1af6z7','dilema','social',NULL,2),
('par_uiplal','dilema','comida',NULL,2),
('par_1yj9esu','dilema','naturaleza',NULL,2),
('par_id4n6z','dilema','fiestas',NULL,2),
('par_8euh4l','dilema','social',NULL,2),
('par_gqqjtu','dilema','comida',NULL,2),
('par_3iqdat','dilema','naturaleza',NULL,2),
('par_9pep54','dilema','fiestas',NULL,2),
('par_2dek9q','dilema','social',NULL,2),
('par_ad1m7k','dilema','comida',NULL,2),
('par_1c9sw51','dilema','naturaleza',NULL,2),
('par_l06evh','dilema','fiestas',NULL,2),
('par_hrwstm','dilema','social',NULL,2),
('par_d9rk4q','dilema','comida',NULL,2),
('par_1lvpdad','dilema','naturaleza',NULL,2),
('par_be5833','dilema','fiestas',NULL,2),
('par_wty70k','dilema','social',NULL,2),
('par_1nrvdmt','dilema','comida',NULL,2),
('par_1qqnjco','dilema','naturaleza',NULL,2),
('par_agxgd7','dilema','fiestas',NULL,2),
('par_1o19ja8','dilema','social',NULL,2),
('par_yogkam','dilema','comida',NULL,2),
('par_6ll6is','dilema','naturaleza',NULL,2),
('par_1u0yh3s','dilema','fiestas',NULL,2),
('par_hk9slp','dilema','social',NULL,2),
('par_13qo4r','dilema','comida',NULL,2),
('par_196byvz','dilema','naturaleza',NULL,2),
('par_yazt3c','dilema','fiestas',NULL,2),
('par_1p6slwb','dilema','social',NULL,2),
('par_1cbz14m','dilema','comida',NULL,2),
('par_3j0kbs','dilema','naturaleza',NULL,2),
('par_ya6wo5','dilema','fiestas',NULL,2),
('par_co3pol','dilema','social',NULL,2),
('par_11gv8de','dilema','comida',NULL,2),
('par_17jvcdr','dilema','naturaleza',NULL,2),
('par_r2lf34','dilema','fiestas',NULL,2),
('par_iooltu','dilema','social',NULL,2),
('par_1gs6hcv','dilema','comida',NULL,2),
('par_1nh3yuv','dilema','naturaleza',NULL,2),
('par_wrjcn0','dilema','fiestas',NULL,2),
('par_ulk5el','dilema','social',NULL,2),
('par_ilbwox','dilema','comida',NULL,2),
('par_1qbli97','dilema','naturaleza',NULL,2),
('par_db02z4','dilema','fiestas',NULL,2),
('par_1kemxwv','dilema','social',NULL,2),
('par_t21rgp','dilema','comida',NULL,2),
('par_d8j2fz','dilema','naturaleza',NULL,2),
('par_f64c1d','dilema','fiestas',NULL,2),
('par_1twbdlb','dilema','social',NULL,2),
('par_s5wsvl','dilema','comida',NULL,2),
('par_1fzjcmj','dilema','naturaleza',NULL,2),
('par_hokcad','dilema','fiestas',NULL,2),
('par_thn430','dilema','social',NULL,2),
('par_18z2gua','dilema','comida',NULL,2),
('par_qo1rs3','dilema','naturaleza',NULL,2),
('par_19jkjy6','dilema','fiestas',NULL,2),
('par_1s1pgdh','dilema','social',NULL,2),
('par_1wxo50y','dilema','comida',NULL,2),
('par_xprt1p','dilema','naturaleza',NULL,2),
('par_4zqpda','dilema','fiestas',NULL,2),
('par_16pbya2','dilema','social',NULL,2),
('par_1doorqj','dilema','comida',NULL,2),
('par_m69aw8','dilema','naturaleza',NULL,2),
('par_1gbzqa4','dilema','fiestas',NULL,2),
('par_ut1zlc','dilema','social',NULL,2),
('par_8r0l5s','dilema','comida',NULL,2),
('par_x7k6fg','dilema','naturaleza',NULL,2),
('par_1sis7h8','dilema','fiestas',NULL,2),
('par_1xwrw76','dilema','social',NULL,2),
('par_xea2iv','dilema','comida',NULL,2),
('par_547hhg','dilema','naturaleza',NULL,2),
('par_khx233','dilema','fiestas',NULL,2),
('par_6dn67g','dilema','social',NULL,2),
('par_1s87kao','dilema','comida',NULL,2),
('par_i898yi','dilema','naturaleza',NULL,2),
('par_u1trqg','dilema','fiestas',NULL,2),
('par_llc420','dilema','social',NULL,2),
('par_nxbsbw','dilema','comida',NULL,2),
('par_1ukjnhx','dilema','naturaleza',NULL,2),
('par_1smw4l','dilema','fiestas',NULL,2),
('par_17zj8s7','dilema','social',NULL,2),
('par_t2pqhw','dilema','comida',NULL,2),
('par_h0y04c','dilema','naturaleza',NULL,2),
('par_80wun0','dilema','fiestas',NULL,2),
('par_qy93ev','dilema','social',NULL,2),
('par_1vxfiev','dilema','comida',NULL,2),
('par_vqfa0r','dilema','naturaleza',NULL,2),
('par_1wxshrh','dilema','fiestas',NULL,2),
('par_wijvvm','dilema','social',NULL,2),
('par_1ackc7f','dilema','comida',NULL,2),
('par_nymwg7','dilema','naturaleza',NULL,2),
('par_1l6cnfj','dilema','fiestas',NULL,2),
('par_5ekuvl','dilema','social',NULL,2),
('par_n6hcpa','dilema','comida',NULL,2),
('par_zulg2n','dilema','naturaleza',NULL,2),
('par_1d33uod','dilema','fiestas',NULL,2),
('par_dg52xf','dilema','social',NULL,2),
('par_11vlm9s','dilema','comida',NULL,2),
('par_1q9abqt','dilema','naturaleza',NULL,2),
('par_1he37xk','dilema','fiestas',NULL,2),
('par_18nma7t','dilema','social',NULL,2),
('par_sflfdk','dilema','comida',NULL,2),
('par_gmyw2','dilema','naturaleza',NULL,2),
('par_1lrjo6y','dilema','fiestas',NULL,2),
('par_jtxe6z','dilema','social',NULL,2),
('par_1hiqupu','dilema','comida',NULL,2),
('par_zr0lh9','dilema','naturaleza',NULL,2),
('par_c9tqlv','dilema','fiestas',NULL,2),
('par_amvbi','dilema','social',NULL,2),
('par_10ss6ls','dilema','comida',NULL,2),
('par_pzy0xg','dilema','naturaleza',NULL,2),
('par_tirene','dilema','fiestas',NULL,2),
('par_1ji005g','dilema','social',NULL,2),
('par_b5ji22','dilema','comida',NULL,2),
('par_72hjma','dilema','naturaleza',NULL,2),
('par_1i56ai','dilema','fiestas',NULL,2),
('par_1oe5s1a','dilema','social',NULL,2),
('par_1doo5bc','dilema','comida',NULL,2),
('par_1db7nd3','dilema','naturaleza',NULL,2),
('par_oole4l','dilema','fiestas',NULL,2),
('par_19raprl','dilema','social',NULL,2),
('par_23k5kw','dilema','comida',NULL,2),
('par_1vr7w8q','dilema','naturaleza',NULL,2),
('par_1s2n8tl','dilema','fiestas',NULL,2),
('par_5m3wmj','dilema','social',NULL,2),
('par_tc5kd','dilema','comida',NULL,2),
('vidrio_domingo','real','casa',0,3),
('bolsa_negra','real','casa',1,3),
('seguro_basico','real','salud',2,3),
('registro_plazo','real','papeles',0,3),
('pan_fondue','real','comida',0,3),
('tarta_cumple','real','trabajo',1,3),
('besos','real','social',2,3),
('cena_hora','real','social',0,3),
('descanso_noche','real','casa',1,3),
('agujeros','real','comida',1,3),
('capital','real','cultura',2,3),
('consejo_federal','real','cultura',1,3),
('idiomas','real','idioma',2,3),
('bunker','real','cultura',0,3),
('gotardo','real','transporte',1,3),
('alpabzug','real','fiestas',1,3),
('schwingen','real','fiestas',1,3),
('en_guete','real','idioma',0,3),
('natel','real','idioma',1,3),
('rostigraben','real','cultura',1,3),
('iglesia','real','papeles',1,3),
('serafe','real','papeles',1,3),
('carnet','real','transporte',1,3),
('senderos','real','naturaleza',1,3),
('onu_ue','real','cultura',1,3),
('kafi','real','comida',1,3),
('orden_pago','real','papeles',1,3),
('samichlaus','real','fiestas',1,3),
('escalade','real','fiestas',0,3),
('boogg','real','fiestas',0,3),
('salario_minimo','real','trabajo',1,3),
('sin_billete','real','transporte',1,3),
('lavar_coche','real','casa',1,3),
('fianza_max','real','casa',1,3),
('certificado_deudas','real','casa',1,3),
('seguro_plazo','real','salud',0,3),
('franquicia','real','salud',0,3),
('cambio_seguro','real','salud',0,3),
('emergencias','real','salud',0,3),
('halbtax','real','transporte',1,3),
('vineta','real','transporte',1,3),
('pilas_tienda','real','casa',1,3),
('pet_super','real','casa',1,3),
('sueldo_13','real','trabajo',0,3),
('vacaciones_min','real','trabajo',1,3),
('periodo_prueba','real','trabajo',0,3),
('garrapatas','real','salud',0,3),
('setas','real','naturaleza',0,3),
('perro_impuesto','real','papeles',1,3),
('nacionalidad_anios','real','papeles',1,3),
('v_8sqbrt','real','casa',1,2),
('v_bmzmfy','real','casa',0,2),
('v_i3j607','real','casa',1,2),
('v_1imcci9','real','casa',1,2),
('v_17ls9qr','real','casa',0,2),
('v_11qqdj8','real','casa',1,2),
('v_jwy4jw','real','casa',0,2),
('v_1gcbrg4','real','casa',1,2),
('v_sdx510','real','casa',1,2),
('v_plh3qu','real','casa',1,2),
('v_c0m1xi','real','casa',0,2),
('v_n2sus5','real','casa',1,2),
('v_11z7al','real','casa',1,2),
('v_1ircewr','real','casa',0,2),
('v_q2cz6k','real','casa',1,2),
('v_1i9oxrr','real','casa',0,2),
('v_h1da9b','real','casa',1,2),
('v_z1ynet','real','casa',0,2),
('v_1vvylp7','real','casa',1,2),
('v_ic7ft2','real','casa',1,2),
('v_1p59y31','real','casa',0,2),
('v_65qwrv','real','casa',0,2),
('v_1gwhq89','real','casa',1,2),
('v_1o99fy5','real','casa',0,2),
('v_ed8qm1','real','casa',1,2),
('v_1nzdki2','real','casa',0,2),
('v_1gb5piy','real','casa',0,2),
('v_153gosl','real','casa',0,2),
('v_1l7imx6','real','casa',1,2),
('v_14z7zp6','real','casa',1,2),
('v_iecia5','real','casa',1,2),
('v_1cl765g','real','casa',1,2),
('v_1uh3y82','real','papeles',1,2),
('v_1er410q','real','papeles',1,2),
('v_1kbz0gv','real','papeles',1,2),
('v_1dnm081','real','papeles',1,2),
('v_vr5mm5','real','papeles',0,2),
('v_mj8xlh','real','papeles',0,2),
('v_1o9fqkc','real','papeles',0,2),
('v_1ab7oxd','real','papeles',1,2),
('v_itmz0w','real','papeles',0,2),
('v_cwpru3','real','papeles',0,2),
('v_16gfr05','real','papeles',1,2),
('v_1sj7oo9','real','papeles',0,2),
('v_bo56f5','real','papeles',0,2),
('v_5xqar8','real','papeles',0,2),
('v_u6sbve','real','papeles',0,2),
('v_5w76y6','real','papeles',1,2),
('v_1c6ohl2','real','papeles',0,2),
('v_mjdtsj','real','papeles',1,2),
('v_pv8skl','real','papeles',1,2),
('v_1dcaa4a','real','papeles',0,2),
('v_fybjea','real','papeles',0,2),
('v_1dwdgix','real','dinero',0,2),
('v_7zf1z4','real','dinero',1,2),
('v_oyd9n3','real','dinero',1,2),
('v_10polzl','real','dinero',1,2),
('v_19af611','real','dinero',0,2),
('v_1qt78p4','real','dinero',1,2),
('v_1dqiav3','real','dinero',0,2),
('v_c533qa','real','dinero',0,2),
('v_n3nhqn','real','dinero',0,2),
('v_75jpqd','real','dinero',0,2),
('v_1ica97h','real','dinero',1,2),
('v_18k119f','real','dinero',1,2),
('v_jnor8m','real','dinero',0,2),
('v_1gb0s8u','real','dinero',0,2),
('v_wb144k','real','dinero',0,2),
('v_opennq','real','dinero',0,2),
('v_8ikgi3','real','dinero',0,2),
('v_d2c2ec','real','dinero',1,2),
('v_1vb5xen','real','dinero',1,2),
('v_yu17cf','real','dinero',0,2),
('v_15haso4','real','dinero',0,2),
('v_m9wrc','real','dinero',0,2),
('v_1kmfn6f','real','salud',1,2),
('v_v16gp5','real','salud',1,2),
('v_1gid0ah','real','salud',0,2),
('v_ijr7k6','real','salud',0,2),
('v_wge2gb','real','salud',1,2),
('v_t1jl5o','real','salud',1,2),
('v_15qclp6','real','salud',1,2),
('v_9n5pw4','real','salud',1,2),
('v_161duda','real','salud',0,2),
('v_18wozzv','real','salud',0,2),
('v_8vfl81','real','salud',0,2),
('v_1qqtswv','real','salud',0,2),
('v_15u4r6g','real','salud',1,2),
('v_15vpbbr','real','salud',1,2),
('v_15nd95v','real','salud',0,2),
('v_kn46lc','real','salud',0,2),
('v_1aif6r4','real','salud',1,2),
('v_89s7oa','real','salud',0,2),
('v_1exj9tw','real','salud',1,2),
('v_39gzvq','real','salud',0,2),
('v_1pxec7p','real','trabajo',1,2),
('v_1xrp1xj','real','trabajo',0,2),
('v_1o71t1l','real','trabajo',1,2),
('v_1i3cfl6','real','trabajo',0,2),
('v_74znr1','real','trabajo',1,2),
('v_wy74km','real','trabajo',0,2),
('v_q37yyj','real','trabajo',1,2),
('v_uddedj','real','trabajo',0,2),
('v_4h5kcn','real','trabajo',0,2),
('v_1cv69od','real','trabajo',0,2),
('v_1f8746y','real','trabajo',1,2),
('v_2apffz','real','trabajo',1,2),
('v_yqoru8','real','trabajo',0,2),
('v_1vqm2d5','real','trabajo',0,2),
('v_1hj9038','real','trabajo',1,2),
('v_1ppscm4','real','trabajo',0,2),
('v_1r0azb5','real','trabajo',0,2),
('v_6cs3f1','real','trabajo',0,2),
('v_ifxqbb','real','trabajo',1,2),
('v_17l0za9','real','trabajo',0,2),
('v_xloval','real','transporte',0,2),
('v_1qhqkt2','real','transporte',0,2),
('v_jrrkw3','real','transporte',1,2),
('v_7r4g1a','real','transporte',1,2),
('v_x4ni1w','real','transporte',1,2),
('v_cj43o8','real','transporte',1,2),
('v_1tjxvfk','real','transporte',1,2),
('v_hb7vnt','real','transporte',0,2),
('v_7l0k1y','real','transporte',0,2),
('v_19btp0h','real','transporte',0,2),
('v_xued9m','real','transporte',0,2),
('v_19qh1fz','real','transporte',1,2),
('v_hbb1yx','real','transporte',0,2),
('v_1al4k5e','real','transporte',1,2),
('v_1ry192r','real','transporte',0,2),
('v_1x0d52l','real','transporte',1,2),
('v_lx0mfb','real','transporte',0,2),
('v_gbb8f9','real','transporte',0,2),
('v_1oeu7vs','real','transporte',1,2),
('v_1j5vags','real','transporte',0,2),
('v_1809mch','real','transporte',1,2),
('v_72esoy','real','transporte',0,2),
('v_b1uhju','real','transporte',1,2),
('v_1xl16g7','real','transporte',1,2),
('v_10t6ji7','real','transporte',1,2),
('v_193w45k','real','transporte',1,2),
('v_zrhr4w','real','social',0,2),
('v_hsov1z','real','transporte',0,2),
('v_1u7r8lg','real','transporte',1,2),
('v_ft87up','real','social',0,2),
('v_12cz7d7','real','social',1,2),
('v_d3m5e3','real','social',1,2),
('v_1icncko','real','social',0,2),
('v_r1sobf','real','social',0,2),
('v_mq4ihx','real','social',0,2),
('v_haew5d','real','social',1,2),
('v_1mqk34s','real','social',0,2),
('v_13ysy99','real','social',1,2),
('v_imnnai','real','social',0,2),
('v_1d2oq5u','real','social',1,2),
('v_136wizf','real','social',0,2),
('v_91vjp2','real','social',0,2),
('v_1t1dxdy','real','social',0,2),
('v_1meuj04','real','social',0,2),
('v_13yjqbz','real','social',1,2),
('v_1sij9ke','real','social',1,2),
('v_n0917r','real','social',0,2),
('v_mq7v2r','real','social',1,2),
('v_qyf1wu','real','social',1,2),
('v_xmms2z','real','social',0,2),
('v_zt7grr','real','social',1,2),
('v_1dkdzl0','real','social',0,2),
('v_y4r61j','real','social',0,2),
('v_18pgc5t','real','fiestas',1,2),
('v_1py8ln2','real','fiestas',0,2),
('v_wlblrt','real','fiestas',0,2),
('v_115gyef','real','fiestas',0,2),
('v_1mvu2ja','real','fiestas',1,2),
('v_vcri7n','real','fiestas',0,2),
('v_9z099','real','fiestas',0,2),
('v_1oml8xb','real','fiestas',1,2),
('v_1cqr9v8','real','fiestas',0,2),
('v_1qzczb2','real','fiestas',1,2),
('v_1y22zis','real','fiestas',0,2),
('v_1vwhu7p','real','fiestas',0,2),
('v_1x0ikl','real','fiestas',0,2),
('v_1b6otw5','real','fiestas',0,2),
('v_1cvktml','real','fiestas',0,2),
('v_7o3vg0','real','fiestas',1,2),
('v_zqlgf4','real','comida',1,2),
('v_2fwlyo','real','comida',1,2),
('v_fbkmdc','real','comida',1,2),
('v_rcxcgd','real','comida',0,2),
('v_1p9mde4','real','comida',1,2),
('v_1p8z9vu','real','comida',1,2),
('v_1m2uqu4','real','comida',1,2),
('v_1qgph0l','real','comida',1,2),
('v_x2272f','real','comida',0,2),
('v_1e8t1me','real','comida',1,2),
('v_r9sr5b','real','comida',0,2),
('v_x1kk1c','real','comida',0,2),
('v_1gcgn1z','real','comida',1,2),
('v_lek6ho','real','comida',1,2),
('v_i4vo0s','real','comida',1,2),
('v_334zih','real','comida',0,2),
('v_1v9bbul','real','comida',1,2),
('v_cpuyq5','real','comida',1,2),
('v_8n745e','real','comida',0,2),
('v_j88frh','real','comida',1,2),
('v_azfwr6','real','naturaleza',1,2),
('v_gnzhjv','real','naturaleza',1,2),
('v_wvxb81','real','naturaleza',0,2),
('v_1at0zzz','real','naturaleza',0,2),
('v_1b9vve6','real','naturaleza',1,2),
('v_6lms8j','real','naturaleza',0,2),
('v_111ji50','real','naturaleza',1,2),
('v_19jbx4h','real','naturaleza',0,2),
('v_1p97whl','real','naturaleza',0,2),
('v_1epy144','real','naturaleza',0,2),
('v_18p0xkl','real','naturaleza',1,2),
('v_124rt31','real','naturaleza',1,2),
('v_1784pgx','real','naturaleza',0,2),
('v_vyuzgc','real','naturaleza',1,2),
('v_1pw5bo6','real','naturaleza',1,2),
('v_1dyo44q','real','naturaleza',0,2),
('v_lselsq','real','naturaleza',0,2),
('v_fs9k0','real','naturaleza',1,2),
('v_ecfzuh','real','naturaleza',0,2),
('v_q4e6y9','real','naturaleza',1,2),
('v_u4rth3','real','idioma',1,2),
('v_1aa7llm','real','idioma',1,2),
('v_9o1mmo','real','idioma',0,2),
('v_14qabbw','real','idioma',0,2),
('v_db002l','real','idioma',1,2),
('v_19czhkg','real','idioma',1,2),
('v_jibgd6','real','idioma',0,2),
('v_pewbdw','real','idioma',1,2),
('v_1dqeqlk','real','idioma',0,2),
('v_12gyntf','real','idioma',1,2),
('v_1doq131','real','cultura',1,2),
('v_1euwhbu','real','cultura',0,2),
('v_3doil','real','cultura',0,2),
('v_1jwvrw','real','cultura',1,2),
('v_slfgih','real','cultura',1,2),
('v_1padr77','real','cultura',1,2),
('v_fvlquw','real','cultura',1,2),
('v_1kkztkl','real','cultura',0,2),
('v_1hq2vjg','real','cultura',0,2),
('v_1my3bii','real','cultura',1,2),
('v_foaty2','real','cultura',1,2),
('v_11nv68r','real','cultura',1,2),
('v_1t9fjd7','real','cultura',1,2),
('v_wqscht','real','cultura',0,2),
('v_cx35f2','real','cultura',0,2),
('r_4q9cd8','real','casa',1,3),
('r_1xyhtme','real','casa',2,3),
('r_m74p6s','real','casa',0,3),
('r_azzg2q','real','casa',1,3),
('r_gqio7a','real','casa',0,3),
('r_168yq5d','real','casa',2,3),
('r_1wg19su','real','casa',1,3),
('r_16juf0f','real','casa',1,3),
('r_1gpkrj7','real','casa',0,3),
('r_fe9nhy','real','casa',1,3),
('r_1vs207q','real','casa',0,3),
('r_1n2ne4z','real','papeles',2,3),
('r_1u7tq6u','real','papeles',2,3),
('r_ftrvfw','real','papeles',0,3),
('r_1j096mv','real','papeles',2,3),
('r_1x7wiz0','real','papeles',1,3),
('r_38ewb0','real','papeles',1,3),
('r_8dxugn','real','papeles',2,3),
('r_no9axg','real','papeles',0,3),
('r_j4l9sz','real','papeles',1,3),
('r_143fn1x','real','papeles',0,3),
('r_8gmj19','real','papeles',1,3),
('r_11mpjos','real','papeles',2,3),
('r_1msumd2','real','papeles',0,3),
('r_1upp2cr','real','papeles',1,3),
('r_5vsvsx','real','dinero',2,3),
('r_1xtlpno','real','dinero',0,3),
('r_pb6h89','real','dinero',0,3),
('r_1eww8ze','real','dinero',2,3),
('r_1cy7tqh','real','dinero',0,3),
('r_1kdxhh5','real','dinero',1,3),
('r_iohd82','real','dinero',2,3),
('r_1xewxob','real','dinero',1,3),
('r_1i6sn91','real','dinero',2,3),
('r_sx7r10','real','dinero',1,3),
('r_w16gxx','real','dinero',1,3),
('r_1sspdf2','real','salud',1,3),
('r_pby0yb','real','salud',2,3),
('r_qy6ok3','real','salud',1,3),
('r_16ezgdi','real','salud',1,3),
('r_wah2io','real','salud',1,3),
('r_1wae1v8','real','salud',1,3),
('r_28rx3i','real','salud',0,3),
('r_1lagykj','real','salud',2,3),
('r_9s7bqk','real','salud',0,3),
('r_1rxrnc9','real','salud',0,3),
('r_kl3bxo','real','trabajo',0,3),
('r_1hpzqlp','real','trabajo',1,3),
('r_xay5ka','real','trabajo',0,3),
('r_db91ur','real','trabajo',2,3),
('r_1l29h81','real','trabajo',1,3),
('r_tgi5v1','real','trabajo',2,3),
('r_1e21u07','real','trabajo',0,3),
('r_1q1331y','real','trabajo',1,3),
('r_658ucj','real','trabajo',1,3),
('r_1cyyvgl','real','trabajo',1,3),
('r_1r922ld','real','trabajo',2,3),
('r_1pveh1x','real','trabajo',0,3),
('r_r6eqnd','real','trabajo',1,3),
('r_1qtfa1t','real','transporte',0,3),
('r_y2boq7','real','transporte',2,3),
('r_14z6ndx','real','transporte',2,3),
('r_12pn0q5','real','transporte',1,3),
('r_1i2glaj','real','transporte',1,3),
('r_16ssm6o','real','transporte',0,3),
('r_1mjqfg3','real','transporte',0,3),
('r_ko1wn5','real','transporte',2,3),
('r_3pnf3h','real','transporte',0,3),
('r_efqy03','real','transporte',0,3),
('r_1ccgdgs','real','transporte',1,3),
('r_1kzge4y','real','transporte',2,3),
('r_d2eopb','real','transporte',1,3),
('r_s5o1xw','real','transporte',1,3),
('r_vll0t1','real','transporte',2,3),
('r_bqe1pe','real','social',2,3),
('r_1h5mjmz','real','social',0,3),
('r_6z4u6a','real','social',2,3),
('r_tos7ur','real','social',0,3),
('r_18yzmqd','real','social',1,3),
('r_174jr6a','real','social',0,3),
('r_17p8pql','real','comida',2,3),
('r_1do0zxg','real','comida',2,3),
('r_1gmmlff','real','comida',2,3),
('r_gjm4gn','real','comida',0,3),
('r_m91ej6','real','comida',1,3),
('r_kzz88u','real','comida',0,3),
('r_lb4qnm','real','comida',1,3),
('r_xrsnvf','real','comida',0,3),
('r_1renaj','real','comida',1,3),
('r_1n93hy','real','comida',0,3),
('r_d3usdb','real','comida',1,3),
('r_bqbcb5','real','fiestas',2,3),
('r_1vvn1mq','real','fiestas',1,3),
('r_11y3e3t','real','fiestas',0,3),
('r_q3304f','real','fiestas',1,3),
('r_1irv7u4','real','fiestas',2,3),
('r_1ddva8d','real','fiestas',1,3),
('r_156swwc','real','fiestas',2,3),
('r_no5fpc','real','fiestas',0,3),
('r_1ea3701','real','naturaleza',1,3),
('r_ooawg5','real','naturaleza',0,3),
('r_7sbv1a','real','naturaleza',1,3),
('r_2c43a2','real','naturaleza',0,3),
('r_16w8e6z','real','naturaleza',1,3),
('r_fukqt5','real','naturaleza',2,3),
('r_uyrwrn','real','naturaleza',0,3),
('r_90kt7e','real','naturaleza',0,3),
('r_zylk82','real','cultura',2,3),
('r_blfkcg','real','cultura',2,3),
('r_u1yxhd','real','cultura',1,3),
('r_ssmaal','real','cultura',1,3),
('r_15xb4si','real','cultura',0,3),
('r_356zdp','real','cultura',0,3),
('r_yhhwz8','real','cultura',0,3),
('r_1stznt6','real','cultura',0,3),
('r_1xv3mer','real','cultura',2,3),
('r_12xjfan','real','cultura',1,3),
('r_1wpaljg','real','cultura',0,3),
('r_6o4ecl','real','cultura',2,3),
('r_xlns2m','real','cultura',0,3),
('r_18k1t91','real','cultura',1,3),
('r_1vf1er2','real','cultura',2,3),
('r_1458hrp','real','cultura',2,3),
('r_1r7mc6q','real','cultura',2,3),
('r_1beyonf','real','cultura',2,3),
('r_10iqsva','real','cultura',2,3),
('r_1t2uvzt','real','cultura',1,3),
('r_qreu2o','real','idioma',2,3),
('r_1d07dpk','real','idioma',1,3),
('r_dzwv4o','real','idioma',0,3),
('r_s136ln','real','idioma',2,3),
('r_1lkldvs','real','idioma',1,3),
('r_1fnujju','real','idioma',0,3),
('r_18olr8r','real','idioma',2,3),
('r_j5gdg8','real','idioma',2,3),
('v_tdjhpt','real','casa',0,2),
('v_s3wv4m','real','casa',1,2),
('v_1cw3gd','real','casa',0,2),
('v_lq6wei','real','casa',1,2),
('v_1sdwrdg','real','casa',0,2),
('v_r42z5s','real','casa',0,2),
('v_ihagrf','real','casa',0,2),
('v_1v2oag7','real','casa',1,2),
('v_1m8jd92','real','casa',0,2),
('v_os890','real','casa',0,2),
('v_a0h4tq','real','casa',1,2),
('v_13iy131','real','casa',1,2),
('v_e093ax','real','casa',0,2),
('v_1qz4bax','real','papeles',0,2),
('v_1wlngld','real','papeles',1,2),
('v_jzt4yk','real','papeles',0,2),
('v_1m233pz','real','papeles',0,2),
('v_1tgit7w','real','papeles',0,2),
('v_1mq7kn4','real','papeles',1,2),
('v_4reswb','real','papeles',0,2),
('v_bj6es3','real','papeles',0,2),
('v_bfl832','real','papeles',0,2),
('v_161nqd7','real','papeles',1,2),
('v_ra6m7p','real','papeles',0,2),
('v_mp6wgc','real','papeles',1,2),
('v_11ualrp','real','dinero',0,2),
('v_1gty8w3','real','dinero',1,2),
('v_jfa9w7','real','dinero',0,2),
('v_m4eu5b','real','dinero',0,2),
('v_qjkytw','real','dinero',1,2),
('v_f1it7m','real','dinero',1,2),
('v_1h3ha8j','real','dinero',1,2),
('v_ze504t','real','dinero',1,2),
('v_cge4ds','real','dinero',0,2),
('v_12u0l4o','real','salud',0,2),
('v_1o7hrev','real','salud',1,2),
('v_8dqfcg','real','salud',1,2),
('v_1x0wn4d','real','salud',1,2),
('v_1unhy4s','real','salud',0,2),
('v_1m2aaq','real','salud',1,2),
('v_1ej3jbw','real','salud',0,2),
('v_i2vhru','real','salud',1,2),
('v_1of4wzo','real','trabajo',1,2),
('v_12vmfl0','real','trabajo',0,2),
('v_9p5506','real','trabajo',0,2),
('v_3leriw','real','trabajo',0,2),
('v_9igjh3','real','trabajo',0,2),
('v_1egf40o','real','trabajo',0,2),
('v_uzefv7','real','trabajo',0,2),
('v_1p3smgw','real','transporte',0,2),
('v_qubbgd','real','transporte',0,2),
('v_1kiku4t','real','transporte',1,2),
('v_1tlh2tv','real','transporte',0,2),
('v_1wfjxek','real','transporte',1,2),
('v_1e1igz4','real','transporte',1,2),
('v_1wfagkh','real','transporte',0,2),
('v_zefowp','real','transporte',1,2),
('v_1yqkm0a','real','transporte',0,2),
('v_1o14g1p','real','transporte',1,2),
('v_17w1ofx','real','transporte',1,2),
('v_f6ufg6','real','social',0,2),
('v_1rxzust','real','social',0,2),
('v_ihk57e','real','social',0,2),
('v_1fxfpyd','real','social',0,2),
('v_1rup1uj','real','social',0,2),
('v_1l7xr31','real','social',0,2),
('v_ca8bbg','real','comida',0,2),
('v_87oggo','real','comida',1,2),
('v_145u9av','real','comida',0,2),
('v_1l94ne','real','comida',0,2),
('v_yupor','real','comida',1,2),
('v_1ta927m','real','comida',0,2),
('v_1b3kfjc','real','comida',0,2),
('v_1rb4lfx','real','comida',0,2),
('v_1lordfi','real','comida',1,2),
('v_1ypik0z','real','comida',0,2),
('v_1j1tqxv','real','naturaleza',0,2),
('v_49ce81','real','naturaleza',0,2),
('v_1hcr4mm','real','naturaleza',1,2),
('v_65v1mi','real','naturaleza',0,2),
('v_1oinuft','real','naturaleza',0,2),
('v_1nyv12m','real','cultura',0,2),
('v_1xzenmd','real','cultura',1,2),
('v_13se33n','real','cultura',0,2),
('v_h21dbu','real','cultura',0,2),
('v_i456zd','real','cultura',0,2),
('v_4y6jh0','real','cultura',1,2),
('v_1jflq69','real','cultura',0,2),
('v_6kdhj4','real','cultura',0,2),
('v_1edwk','real','fiestas',0,2),
('r_ipkw6h','real','trabajo',2,3),
('r_1mbht4u','real','trabajo',1,3),
('r_m36muw','real','trabajo',2,3),
('r_1avgnb1','real','trabajo',1,3),
('r_s687jv','real','trabajo',1,3),
('r_fpm25e','real','trabajo',1,3),
('r_1gn3atr','real','trabajo',2,3),
('r_1ebn6qt','real','trabajo',0,3),
('r_5vjagk','real','trabajo',1,3),
('v_e57o0f','real','trabajo',0,2),
('v_181d3hs','real','trabajo',1,2),
('v_dkg0tu','real','trabajo',0,2),
('v_14b0ao1','real','trabajo',0,2),
('v_1w6mno','real','trabajo',0,2),
('r_1evlyby','real','dinero',1,3),
('r_2s0drv','real','dinero',1,3),
('r_6hjelw','real','dinero',1,3),
('r_160t7hz','real','dinero',0,3),
('r_pon9m5','real','dinero',2,3),
('r_1d2mxna','real','dinero',0,3),
('v_1r1akty','real','dinero',0,2),
('v_149b58p','real','dinero',0,2),
('v_y5jjyj','real','dinero',0,2),
('v_1wqed97','real','dinero',0,2),
('r_1snxj8j','real','salud',0,3),
('r_gklsfl','real','salud',2,3),
('r_1pbh9bx','real','salud',2,3),
('r_sw16vz','real','salud',2,3),
('r_1rg84nc','real','salud',2,3),
('r_s5b0by','real','salud',0,3),
('r_1ohexp9','real','salud',0,3),
('v_1tewlkb','real','salud',1,2),
('v_1x1mkwb','real','salud',1,2),
('v_1t0iq44','real','salud',1,2),
('r_pl28db','real','papeles',0,3),
('r_c3hc13','real','papeles',0,3),
('r_nojrhn','real','papeles',2,3),
('r_use3kd','real','papeles',1,3),
('r_1a1y2db','real','papeles',1,3),
('r_14wddya','real','papeles',0,3),
('r_1xjhfhn','real','papeles',1,3),
('v_svtqtm','real','papeles',0,2),
('v_km93z9','real','papeles',1,2),
('v_1b58z4c','real','papeles',0,2),
('r_dtrued','real','transporte',2,3),
('r_tpikwa','real','transporte',0,3),
('r_1otz93m','real','transporte',1,3),
('r_1kgubiv','real','transporte',2,3),
('r_1xcpart','real','transporte',1,3),
('r_1hx7wy3','real','transporte',2,3),
('r_bjsw4y','real','transporte',0,3),
('r_1te3wgy','real','transporte',2,3),
('r_qiu5nn','real','transporte',0,3),
('v_18sb6s6','real','transporte',0,2),
('v_1g2zgie','real','transporte',1,2),
('v_ewgs29','real','transporte',0,2),
('r_h562cz','real','casa',2,3),
('r_1inewup','real','casa',2,3),
('r_18z3gt4','real','casa',0,3),
('r_zo8fx','real','casa',1,3),
('r_y2yuix','real','casa',2,3),
('v_1q0smhv','real','casa',0,2),
('v_46rfq','real','casa',0,2),
('v_vamnx2','real','casa',1,2),
('r_139c281','real','social',0,3),
('r_kg0rri','real','cultura',2,3),
('r_dgzpir','real','social',0,3),
('r_xk5dny','real','social',1,3),
('r_1n9fh57','real','idioma',2,3),
('r_o06mno','real','social',0,3),
('r_1bf6ccg','real','cultura',0,3),
('v_r9st03','real','social',0,2),
('v_325xmo','real','social',0,2),
('v_1hnaibm','real','naturaleza',0,2),
('v_v8x62i','real','dinero',1,2),
('v_v588lf','real','casa',0,2),
('v_1ga8p92','real','transporte',0,2),
('v_1no9s0i','real','salud',0,2),
('v_e8cbb','real','social',1,2),
('v_1hi9ouv','real','trabajo',1,2),
('voc_m2glr5','real','idioma',1,3),
('voc_9gqg7q','real','idioma',0,3),
('voc_zo0xfi','real','idioma',2,3),
('voc_f1kw8q','real','idioma',2,3),
('voc_73gyeg','real','idioma',1,3),
('voc_1r6xy9s','real','idioma',0,3),
('voc_1yc8upw','real','idioma',0,3),
('voc_ez4ckd','real','idioma',2,3),
('voc_9gowv','real','idioma',0,3),
('voc_xwcufl','real','idioma',0,3),
('voc_1m5xvqa','real','idioma',1,3),
('voc_1tzcdei','real','idioma',2,3),
('voc_15p8jfm','real','idioma',1,3),
('voc_1j8yzf4','real','idioma',1,3),
('voc_1hvp94e','real','idioma',1,3),
('voc_1l60gd','real','idioma',1,3),
('voc_1k44rpo','real','idioma',0,3),
('voc_1i482vn','real','idioma',1,3),
('voc_1xl81ww','real','idioma',0,3),
('voc_hy2d2r','real','idioma',1,3),
('voc_1abfnhn','real','idioma',2,3),
('voc_1s5depo','real','idioma',1,3),
('voc_2y931l','real','idioma',1,3),
('voc_lx8o6l','real','idioma',2,3),
('voc_1yaggok','real','idioma',1,3),
('voc_1il40mq','real','idioma',1,3),
('voc_1qqkcxu','real','idioma',0,3),
('voc_rho1yc','real','idioma',2,3),
('voc_t5cii','real','idioma',2,3),
('voc_7u990h','real','idioma',0,3),
('voc_xh462d','real','idioma',0,3),
('voc_xmpj72','real','idioma',2,3),
('voc_wudmot','real','idioma',1,3),
('voc_10bbg9w','real','idioma',0,3),
('voc_mxbrt9','real','idioma',0,3),
('voc_figrn4','real','idioma',2,3),
('voc_s4qdo','real','idioma',0,3),
('voc_gxie66','real','idioma',0,3),
('voc_1s99qa8','real','idioma',1,3),
('voc_carfe3','real','idioma',0,3),
('voc_1cef8xa','real','idioma',1,3),
('voc_1tv7ill','real','idioma',0,3),
('voc_evlsla','real','idioma',1,3),
('voc_lt5g88','real','idioma',0,3),
('voc_1j03wdu','real','idioma',1,3),
('voc_1slf1oz','real','idioma',0,3),
('voc_dn7yr0','real','idioma',1,3),
('voc_q704vj','real','idioma',1,3),
('voc_1a4l2y2','real','idioma',0,3),
('voc_1vd1f26','real','idioma',1,3),
('voc_130uera','real','idioma',2,3),
('voc_ppu3mu','real','idioma',2,3),
('voc_lm191b','real','idioma',2,3),
('voc_szkybx','real','idioma',1,3),
('voc_f5z9ug','real','idioma',2,3),
('voc_1dzv46a','real','idioma',1,3),
('voc_dlm0fq','real','idioma',1,3),
('voc_in7v3d','real','idioma',1,3),
('voc_196o7n2','real','idioma',0,3),
('voc_1f1z91m','real','idioma',2,3),
('voc_94dcl0','real','idioma',2,3),
('voc_qzbw1l','real','idioma',2,3),
('voc_fs81t9','real','idioma',1,3),
('voc_1urrd02','real','idioma',0,3),
('voc_1b3z7wg','real','idioma',0,3),
('voc_n5n5i4','real','idioma',2,3),
('voc_1euw3bo','real','idioma',0,3),
('voc_1lpga07','real','idioma',2,3),
('voc_1nvj14r','real','idioma',1,3),
('voc_1yvm3h3','real','idioma',0,3),
('voc_n6f4vj','real','idioma',2,3),
('voc_9g495m','real','idioma',1,3),
('voc_9ce8nh','real','idioma',1,3),
('voc_xfmys5','real','idioma',0,3),
('voc_1q0hxn5','real','idioma',2,3),
('voc_fghhvn','real','idioma',2,3),
('voc_xe4sma','real','idioma',0,3),
('voc_xbthvi','real','idioma',0,3),
('voc_gge13c','real','idioma',2,3),
('voc_l76cm0','real','idioma',0,3),
('voc_ha9iwk','real','idioma',2,3),
('voc_kuhgqu','real','idioma',2,3),
('voc_qs7a0e','real','idioma',2,3),
('voc_1vvblc8','real','idioma',2,3),
('voc_3jmdyz','real','idioma',2,3),
('voc_ryhad7','real','idioma',0,3),
('voc_edkjum','real','idioma',0,3),
('voc_1ised2o','real','idioma',1,3),
('voc_1vna4e0','real','idioma',1,3),
('voc_hhzami','real','idioma',0,3),
('voc_kw5i6m','real','idioma',2,3),
('voc_ml8zqq','real','idioma',0,3),
('voc_3ci2nk','real','idioma',1,3),
('voc_1drkzjo','real','idioma',1,3),
('voc_kdkfs7','real','idioma',2,3),
('voc_1aferv1','real','idioma',1,3),
('voc_oxvutq','real','idioma',1,3),
('voc_1e9pmbt','real','idioma',1,3),
('voc_ev5qaj','real','idioma',2,3),
('voc_nv6igq','real','idioma',2,3),
('voc_18gxmox','real','idioma',0,3),
('voc_nqf4sh','real','idioma',2,3),
('voc_7sdjxt','real','idioma',1,3),
('voc_tyofsr','real','idioma',1,3),
('voc_r8ql7n','real','idioma',2,3),
('voc_onag0x','real','idioma',2,3),
('voc_1xm3pje','real','idioma',2,3),
('voc_5fwvmu','real','idioma',1,3),
('voc_ljrmfq','real','idioma',2,3),
('voc_1abjcqc','real','idioma',2,3),
('voc_n0tug0','real','idioma',0,3),
('voc_12p8skb','real','idioma',1,3),
('voc_xz2sn3','real','idioma',0,3),
('voc_1k3p45p','real','idioma',2,3),
('voc_f5qmju','real','idioma',1,3),
('voc_1eppskv','real','idioma',1,3),
('voc_tz0nfh','real','idioma',2,3),
('voc_16x2w6s','real','idioma',1,3),
('voc_4zb23e','real','idioma',2,3),
('voc_oh5o9m','real','idioma',1,3),
('voc_1fpu4xt','real','idioma',2,3),
('voc_1rqso1b','real','idioma',0,3),
('voc_x0prws','real','idioma',2,3),
('voc_16uc3ix','real','idioma',1,3),
('voc_nx746q','real','idioma',0,3),
('voc_15sxe3y','real','idioma',1,3),
('voc_8vv4po','real','idioma',0,3),
('voc_kubkkp','real','idioma',1,3),
('voc_gnc1an','real','idioma',1,3),
('voc_1vi3ob4','real','idioma',2,3),
('voc_78wprw','real','idioma',0,3),
('voc_ez3xui','real','idioma',0,3),
('voc_yy7cjl','real','idioma',1,3),
('voc_g1atvk','real','idioma',2,3),
('voc_vntg0n','real','idioma',2,3),
('voc_1vk1x26','real','idioma',0,3),
('voc_1xwtxse','real','idioma',1,3),
('voc_1fse9jh','real','idioma',2,3),
('voc_1lumofq','real','idioma',0,3),
('voc_18q5mdr','real','idioma',2,3),
('voc_668ekr','real','idioma',1,3),
('voc_14izf3k','real','idioma',0,3),
('voc_wkv4qa','real','idioma',2,3),
('voc_11hfosa','real','idioma',1,3),
('voc_doy97w','real','idioma',0,3),
('voc_5vj247','real','idioma',0,3),
('voc_13xvjkb','real','idioma',1,3),
('voc_h7lael','real','idioma',0,3),
('voc_11vjucx','real','idioma',0,3),
('voc_1xz7oeq','real','idioma',2,3),
('voc_t5sv6m','real','idioma',2,3),
('voc_1n18znl','real','idioma',1,3),
('voc_1eki011','real','idioma',1,3),
('voc_12clnae','real','idioma',1,3),
('voc_71elee','real','idioma',0,3),
('voc_12by7mq','real','idioma',2,3),
('voc_m6vgg0','real','idioma',2,3),
('voc_1ch3fn','real','idioma',1,3),
('voc_buvt8g','real','idioma',0,3),
('voc_1izbkf7','real','idioma',1,3),
('voc_7g47zg','real','idioma',1,3),
('voc_mxx7oz','real','idioma',0,3),
('voc_1f0uvyk','real','idioma',2,3),
('voc_11o3pr2','real','idioma',0,3),
('voc_d3tv9d','real','idioma',0,3),
('voc_18pxuzv','real','idioma',2,3),
('voc_hxmo1l','real','idioma',1,3),
('voc_1jksbje','real','idioma',1,3),
('voc_u7vmez','real','idioma',1,3),
('voc_fgd687','real','idioma',0,3),
('voc_j288ho','real','idioma',0,3),
('voc_my1qfv','real','idioma',1,3),
('voc_1jz7pe1','real','idioma',2,3),
('voc_ynslns','real','idioma',0,3),
('voc_16jekz3','real','idioma',0,3),
('voc_9tqcr4','real','idioma',0,3),
('voc_1edbxky','real','idioma',1,3),
('voc_1afmluc','real','idioma',0,3),
('voc_1y8jg7r','real','idioma',1,3),
('voc_rd0zzu','real','idioma',2,3),
('voc_r7u44g','real','idioma',2,3),
('voc_1o5br4w','real','idioma',0,3),
('voc_bjy8ai','real','idioma',1,3),
('voc_l3sslu','real','idioma',2,3),
('voc_1n2uyqp','real','idioma',2,3),
('voc_1aug1b9','real','idioma',1,3),
('voc_100xzog','real','idioma',2,3),
('voc_757g4g','real','idioma',1,3),
('voc_jzpw51','real','idioma',1,3),
('voc_1sdb5ac','real','idioma',2,3),
('voc_ce1fht','real','idioma',0,3),
('ciu_iek7ww','real','cultura',1,3),
('ciu_1784dhm','real','cultura',0,3),
('ciu_1mef30v','real','cultura',2,3),
('ciu_4ext5t','real','cultura',0,3),
('ciu_1id4k1t','real','cultura',0,3),
('ciu_92fvt2','real','cultura',0,3),
('ciu_8sjo0z','real','cultura',1,3),
('ciu_1dyt7gw','real','cultura',1,3),
('ciu_1l2fhvl','real','cultura',1,3),
('ciu_zl6vft','real','cultura',2,3),
('ciu_8pbvlg','real','cultura',2,3),
('ciu_tjdet4','real','cultura',0,3),
('ciu_i0ntc8','real','cultura',2,3),
('ciu_10t27cl','real','cultura',0,3),
('ciu_1q2yigl','real','cultura',2,3),
('ciu_x52ac1','real','cultura',1,3),
('ciu_j6s3pi','real','cultura',2,3),
('ciu_mlq7a5','real','cultura',0,3),
('ciu_47fdfv','real','cultura',2,3),
('ciu_1frkm4c','real','cultura',2,3),
('ciu_bj3kmb','real','cultura',0,3),
('ciu_tntngn','real','cultura',2,3),
('ciu_drrhq8','real','cultura',2,3),
('ciu_1c9fyj','real','cultura',1,3),
('ciu_6r6t4g','real','cultura',1,3),
('ciu_138e4f0','real','cultura',2,3),
('ciu_1ozz5x0','real','cultura',0,3),
('ciu_y1qi6g','real','cultura',2,3),
('ciu_yza8hh','real','cultura',1,3),
('ciu_1vbxo3c','real','cultura',2,3),
('ciu_4hib3w','real','cultura',0,3),
('ciu_1kpad0p','real','cultura',0,3),
('ciu_1ad58bz','real','cultura',0,3),
('ciu_1tjnhpr','real','cultura',1,3),
('ciu_1bc7shb','real','cultura',1,3),
('ciu_piixg2','real','cultura',1,3),
('ciu_1rkmxxx','real','cultura',0,3),
('ciu_1gn4zxf','real','cultura',1,3),
('ciu_4fzxiq','real','cultura',2,3),
('ciu_1pasvx3','real','cultura',0,3),
('cap_blupch','real','cultura',1,3),
('capr_blupch','real','cultura',1,3),
('cap_9xx36n','real','cultura',1,3),
('capr_9xx36n','real','cultura',2,3),
('cap_gvn5iy','real','cultura',1,3),
('capr_gvn5iy','real','cultura',2,3),
('cap_949y7f','real','cultura',0,3),
('capr_949y7f','real','cultura',2,3),
('cap_cq4s82','real','cultura',0,3),
('capr_cq4s82','real','cultura',2,3),
('cap_u6xrto','real','cultura',2,3),
('capr_u6xrto','real','cultura',1,3),
('cap_fis8rc','real','cultura',2,3),
('capr_fis8rc','real','cultura',1,3),
('cap_bmizg2','real','cultura',0,3),
('capr_bmizg2','real','cultura',0,3),
('cap_xtk1fv','real','cultura',0,3),
('capr_xtk1fv','real','cultura',2,3),
('cap_77agy4','real','cultura',0,3),
('capr_77agy4','real','cultura',0,3),
('cap_8v833y','real','cultura',1,3),
('capr_8v833y','real','cultura',0,3),
('cap_s0dih2','real','cultura',0,3),
('capr_s0dih2','real','cultura',2,3),
('cap_t4ldqv','real','cultura',2,3),
('capr_t4ldqv','real','cultura',0,3),
('cap_wqg7ri','real','cultura',0,3),
('capr_wqg7ri','real','cultura',0,3),
('fec_1o6uykw','real','cultura',2,3),
('fec_th53xv','real','cultura',1,3),
('fec_1qo3zus','real','cultura',0,3),
('fec_1atazao','real','cultura',2,3),
('fec_r8ks40','real','cultura',0,3),
('fec_1kxi5f5','real','cultura',1,3),
('fec_a5ia4t','real','cultura',0,3),
('fec_1qhtnr','real','cultura',2,3),
('fec_1ntryxw','real','cultura',2,3),
('fec_1xuzd1r','real','cultura',2,3),
('fec_14p5g2q','real','cultura',2,3),
('fec_1spiy3z','real','cultura',0,3),
('fec_1fxw77w','real','cultura',1,3),
('fec_14rqwox','real','cultura',0,3),
('fec_kb9pca','real','cultura',2,3),
('fec_u12sqw','real','cultura',0,3),
('fec_1ciop5l','real','cultura',2,3),
('fec_8yywhd','real','cultura',0,3),
('fec_3p7sfp','real','cultura',2,3),
('fec_nwng9t','real','cultura',1,3),
('fec_d5srn','real','cultura',0,3),
('fec_h2egpf','real','cultura',0,3),
('fec_1oxtlvk','real','cultura',2,3),
('fec_764fln','real','cultura',2,3),
('fec_1j17j6h','real','cultura',1,3),
('fec_170j7at','real','cultura',2,3),
('fec_78cew8','real','cultura',2,3),
('fec_1bmna8y','real','cultura',1,3),
('fec_16b3ewv','real','cultura',0,3),
('fec_rmkkwc','real','cultura',2,3),
('fec_1dvffi8','real','cultura',0,3),
('fec_lpt2dh','real','cultura',2,3),
('fec_11i813b','real','cultura',0,3),
('fec_y20ud4','real','cultura',2,3),
('fec_5fqpgr','real','cultura',2,3),
('fec_1t8w9tr','real','cultura',0,3),
('fec_opcvlz','real','cultura',1,3),
('fec_1mfukhk','real','cultura',1,3),
('fec_4xc9h8','real','cultura',2,3),
('fec_1tq9g5y','real','cultura',0,3),
('per_195ucsv','real','cultura',0,3),
('per_1whf753','real','cultura',2,3),
('per_1rumr3z','real','cultura',2,3),
('per_lenx8c','real','cultura',0,3),
('per_7vpsbs','real','cultura',2,3),
('per_od1pqm','real','cultura',1,3),
('per_aha4ou','real','cultura',1,3),
('per_1qqwcrm','real','cultura',0,3),
('per_1eq4zcj','real','cultura',1,3),
('per_1loy0zv','real','cultura',0,3),
('per_1jrk95d','real','cultura',0,3),
('per_1p4r9xf','real','cultura',1,3),
('per_4km00f','real','cultura',2,3),
('per_18g1cy7','real','cultura',0,3),
('per_10z8gzd','real','cultura',2,3),
('per_o8oorv','real','cultura',0,3),
('per_1obsi1j','real','cultura',0,3),
('per_1nxhi2v','real','cultura',2,3),
('per_7fs459','real','cultura',0,3),
('per_1tjsp5r','real','cultura',0,3),
('per_gbfdca','real','cultura',2,3),
('per_10f7g8g','real','cultura',2,3),
('per_17mml8o','real','cultura',0,3),
('per_c6y02x','real','cultura',2,3),
('per_awy5ko','real','cultura',0,3),
('per_1fs0uff','real','cultura',2,3),
('per_1dxxy7j','real','cultura',1,3),
('per_1btd1r5','real','cultura',1,3),
('per_98970x','real','cultura',1,3),
('per_1miz6gv','real','cultura',1,3),
('per_1cblxtc','real','cultura',2,3),
('per_1x2d6cm','real','cultura',0,3),
('per_1wx94fn','real','cultura',1,3),
('per_139drxd','real','cultura',1,3),
('per_11socwf','real','cultura',1,3),
('per_1k6f4js','real','cultura',1,3),
('per_4qly3k','real','cultura',2,3),
('per_1sxhj4j','real','cultura',0,3),
('per_s6sg1m','real','cultura',0,3),
('per_1iwf5xo','real','cultura',1,3),
('inv_oped5b','real','cultura',1,3),
('inv_8jha0u','real','cultura',0,3),
('inv_sxo17t','real','cultura',2,3),
('inv_4eh3qx','real','cultura',2,3),
('inv_6l2fyv','real','cultura',0,3),
('inv_1caocon','real','cultura',1,3),
('inv_1n1i0fj','real','cultura',2,3),
('inv_1dbbifr','real','cultura',1,3),
('inv_11jpr6v','real','cultura',1,3),
('inv_9wo2xh','real','cultura',1,3),
('inv_k2fcsj','real','cultura',0,3),
('inv_a68yce','real','cultura',2,3),
('inv_1pokm3i','real','cultura',1,3),
('inv_13l8ci0','real','cultura',1,3),
('inv_1jajbkf','real','cultura',0,3),
('inv_nglod','real','cultura',2,3),
('inv_1ldz4mk','real','cultura',2,3),
('inv_1yugnl4','real','cultura',1,3),
('inv_1pd6pg2','real','cultura',1,3),
('inv_ff4vul','real','cultura',2,3),
('vocr_fs81t9','real','idioma',2,3),
('vocr_ynslns','real','idioma',0,3),
('vocr_ljrmfq','real','idioma',1,3),
('vocr_hhzami','real','idioma',1,3),
('vocr_kw5i6m','real','idioma',2,3),
('vocr_lm191b','real','idioma',1,3),
('vocr_carfe3','real','idioma',1,3),
('vocr_9gqg7q','real','idioma',0,3),
('vocr_1yvm3h3','real','idioma',1,3),
('vocr_qzbw1l','real','idioma',2,3),
('vocr_g1atvk','real','idioma',2,3),
('vocr_oxvutq','real','idioma',0,3),
('vocr_1vk1x26','real','idioma',0,3),
('vocr_1s99qa8','real','idioma',1,3),
('vocr_tz0nfh','real','idioma',0,3),
('vocr_my1qfv','real','idioma',0,3),
('vocr_8vv4po','real','idioma',0,3),
('vocr_gxie66','real','idioma',2,3),
('vocr_1lumofq','real','idioma',0,3),
('vocr_mxx7oz','real','idioma',2,3),
('vocr_r7u44g','real','idioma',1,3),
('vocr_1j8yzf4','real','idioma',1,3),
('vocr_xz2sn3','real','idioma',1,3),
('vocr_gnc1an','real','idioma',1,3),
('vocr_3ci2nk','real','idioma',0,3),
('vocr_tyofsr','real','idioma',0,3),
('vocr_11vjucx','real','idioma',1,3),
('vocr_71elee','real','idioma',0,3),
('vocr_1euw3bo','real','idioma',1,3),
('vocr_ryhad7','real','idioma',1,3),
('vocr_18q5mdr','real','idioma',2,3),
('vocr_9ce8nh','real','idioma',0,3),
('vocr_1sdb5ac','real','idioma',2,3),
('vocr_xmpj72','real','idioma',2,3),
('vocr_doy97w','real','idioma',1,3),
('vocr_1k44rpo','real','idioma',0,3),
('vocr_1aug1b9','real','idioma',2,3)
ON CONFLICT (id) DO NOTHING;

-- 03-funciones

CREATE OR REPLACE FUNCTION suizamente_social.hoy() RETURNS date
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT (now() AT TIME ZONE 'Europe/Zurich')::date $$;

CREATE OR REPLACE FUNCTION suizamente_social.notificar(p_jugador text,p_ref text,p_titulo text,p_texto text,p_href text)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public,suizamente_social AS $$
BEGIN
  IF p_jugador LIKE 'user:%' AND EXISTS(SELECT 1 FROM suizamente_social.jugadores WHERE id=p_jugador
    AND coalesce((ajustes->>'avisos')::boolean,true)) THEN
    INSERT INTO public.app_notifications(recipient_id,kind,source_id,data)
      VALUES(substring(p_jugador FROM 6)::uuid,'suizamente',p_ref,
        jsonb_build_object('title',p_titulo,'body',p_texto,'href',p_href,'icon','🎲')) ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION suizamente_social.sumar(p_jugador text,p_motivo text,p_ref text,p_puntos integer,p_canton text,p_fecha timestamptz DEFAULT now())
RETURNS void LANGUAGE sql SET search_path=pg_catalog,public,suizamente_social AS $$
  INSERT INTO suizamente_social.puntos VALUES(p_jugador,p_motivo,p_ref,p_puntos,p_canton,p_fecha)
  ON CONFLICT DO NOTHING
$$;

CREATE OR REPLACE FUNCTION suizamente_social.registrar(p_jugador text,p_pregunta text,p_opcion integer,p_fecha timestamptz DEFAULT now())
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public,suizamente_social AS $$
DECLARE q suizamente_social.preguntas; j suizamente_social.jugadores; n integer; racha integer; acierto boolean;
BEGIN
  SELECT * INTO j FROM suizamente_social.jugadores WHERE id=p_jugador FOR UPDATE;
  SELECT * INTO q FROM suizamente_social.preguntas WHERE id=p_pregunta;
  IF q.id IS NULL OR p_opcion<0 OR p_opcion>=q.opciones THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Opción no válida'; END IF;
  acierto:=CASE WHEN q.tipo='real' THEN p_opcion=q.correcta END;
  INSERT INTO suizamente_social.respuestas VALUES(p_jugador,p_pregunta,p_opcion,acierto,j.canton,p_fecha)
    ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n=0 THEN RETURN; END IF;
  IF q.tipo='dilema' THEN PERFORM suizamente_social.sumar(p_jugador,'respuesta',p_pregunta,5,j.canton,p_fecha);
  ELSIF acierto THEN
    racha:=CASE WHEN j.ultimo_acierto>=p_fecha-interval '30 minutes' THEN j.aciertos_seguidos+1 ELSE 1 END;
    UPDATE suizamente_social.jugadores SET aciertos_seguidos=racha,ultimo_acierto=p_fecha WHERE id=p_jugador;
    PERFORM suizamente_social.sumar(p_jugador,'respuesta',p_pregunta,CASE WHEN racha>=3 THEN 15 ELSE 10 END,j.canton,p_fecha);
  ELSE
    UPDATE suizamente_social.jugadores SET aciertos_seguidos=0,ultimo_acierto=NULL WHERE id=p_jugador;
    PERFORM suizamente_social.sumar(p_jugador,'respuesta',p_pregunta,0,j.canton,p_fecha);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION suizamente_social.racha(p_jugador text,p_retos boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public,suizamente_social AS $$
DECLARE d date; n integer:=0; actual date:=suizamente_social.hoy();
BEGIN
  FOR d IN SELECT DISTINCT dia FROM (
    SELECT (creado_en AT TIME ZONE 'Europe/Zurich')::date dia FROM suizamente_social.respuestas WHERE jugador=p_jugador AND NOT p_retos
    UNION SELECT fecha FROM suizamente_social.diarias WHERE jugador=p_jugador AND p_retos GROUP BY fecha HAVING count(*)=5
  ) dias ORDER BY dia DESC LOOP
    IF n=0 AND d=actual-1 THEN actual:=actual-1; END IF;
    IF d<>actual THEN EXIT; END IF;
    n:=n+1; actual:=actual-1;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION suizamente_social.logros(p_jugador text) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,public,suizamente_social AS $$
DECLARE detalle jsonb; ganado record;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('id',id,'progreso',least(progreso,meta),'meta',meta,'conseguida',m.medalla IS NOT NULL)) INTO detalle
  FROM (
    SELECT 'puntualidad' id,suizamente_social.racha(p_jugador) progreso,7 meta
    UNION ALL SELECT 'reciclaje',count(*)::int,10 FROM suizamente_social.respuestas r JOIN suizamente_social.preguntas q ON q.id=r.pregunta WHERE r.jugador=p_jugador AND r.acierto AND q.tema='casa'
    UNION ALL SELECT 'fondue',count(*)::int,10 FROM suizamente_social.respuestas r JOIN suizamente_social.preguntas q ON q.id=r.pregunta WHERE r.jugador=p_jugador AND r.acierto AND q.tema='comida'
    UNION ALL SELECT 'papeles',count(*)::int,10 FROM suizamente_social.respuestas r JOIN suizamente_social.preguntas q ON q.id=r.pregunta WHERE r.jugador=p_jugador AND r.acierto AND q.tema='papeles'
    UNION ALL SELECT 'comunidad',count(*)::int,100 FROM suizamente_social.respuestas r JOIN suizamente_social.preguntas q ON q.id=r.pregunta WHERE r.jugador=p_jugador AND q.tipo='dilema'
    UNION ALL SELECT 'poliglota',count(*)::int,20 FROM suizamente_social.respuestas r JOIN suizamente_social.preguntas q ON q.id=r.pregunta WHERE r.jugador=p_jugador AND r.acierto AND q.tema='idioma'
    UNION ALL SELECT 'duelista',count(*)::int,5 FROM suizamente_social.puntos WHERE jugador=p_jugador AND motivo='duelo' AND cantidad=20
    UNION ALL SELECT 'corazon',count(*)::int,1 FROM suizamente_social.propuestas WHERE jugador=p_jugador AND estado='publicada'
    UNION ALL SELECT 'cumbre',suizamente_social.racha(p_jugador,true),30
  ) t LEFT JOIN suizamente_social.medallas m ON m.jugador=p_jugador AND m.medalla=t.id;
  FOR ganado IN SELECT e->>'id' id FROM jsonb_array_elements(detalle) e WHERE (e->>'progreso')::int>=(e->>'meta')::int LOOP
    INSERT INTO suizamente_social.medallas VALUES(p_jugador,ganado.id,now()) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN (SELECT jsonb_agg(e||jsonb_build_object('conseguida',EXISTS(SELECT 1 FROM suizamente_social.medallas WHERE jugador=p_jugador AND medalla=e->>'id'))) FROM jsonb_array_elements(detalle) e);
END $$;

CREATE OR REPLACE FUNCTION suizamente_social.perfil(p_jugador text) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,public,suizamente_social AS $$
DECLARE j suizamente_social.jugadores; puntos integer; temas jsonb; total integer; reales integer; buenas integer;
  niveles integer[]:=ARRAY[0,150,500,1200,2500,5000]; nombres text[]:=ARRAY['Maleta en mano','Permiso L','Permiso B','Permiso C','Pasaporte rojo','Leyenda alpina']; nivel integer:=1;
  suizo integer; latino integer; medallas jsonb;
BEGIN
  SELECT * INTO j FROM suizamente_social.jugadores WHERE id=p_jugador;
  SELECT coalesce(sum(cantidad),0)::int INTO puntos FROM suizamente_social.puntos WHERE jugador=p_jugador;
  WHILE nivel<6 AND puntos>=niveles[nivel+1] LOOP nivel:=nivel+1; END LOOP;
  SELECT count(*),count(*) FILTER(WHERE r.acierto IS NOT NULL),count(*) FILTER(WHERE r.acierto) INTO total,reales,buenas FROM suizamente_social.respuestas r WHERE r.jugador=p_jugador;
  SELECT coalesce(jsonb_agg(t ORDER BY t.aciertos DESC),'[]') INTO temas FROM
    (SELECT q.tema,count(*) cantidad,round(100.0*count(*) FILTER(WHERE r.acierto)/count(*))::int aciertos
     FROM suizamente_social.respuestas r JOIN suizamente_social.preguntas q ON q.id=r.pregunta
     WHERE r.jugador=p_jugador AND q.tipo='real' GROUP BY q.tema HAVING count(*)>=5) t;
  WITH grupos AS (
    SELECT v.pregunta_id,jj.anos_suiza,count(*) n,
      ARRAY[count(*) FILTER(WHERE v.opcion=0),count(*) FILTER(WHERE v.opcion=1),count(*) FILTER(WHERE v.opcion=2)] votos
    FROM public.suizamente_votos v JOIN suizamente_social.jugadores jj ON jj.id=v.jugador_id
    JOIN suizamente_social.preguntas q ON q.id=v.pregunta_id
    WHERE q.tipo='dilema' AND jj.anos_suiza IN ('menos1','mas10') GROUP BY v.pregunta_id,jj.anos_suiza HAVING count(*)>=20
  ), decisivas AS (
    SELECT a.pregunta_id,a.votos antiguos,a.n na,b.votos nuevos,b.n nn
    FROM grupos a JOIN grupos b ON a.pregunta_id=b.pregunta_id AND b.anos_suiza='menos1'
    WHERE a.anos_suiza='mas10' AND EXISTS(SELECT 1 FROM generate_series(1,3) i WHERE abs(a.votos[i]*1.0/a.n-b.votos[i]*1.0/b.n)>=0.10)
  ) SELECT count(*) FILTER(WHERE d.antiguos[r.opcion+1]*1.0/d.na>d.nuevos[r.opcion+1]*1.0/d.nn),
      count(*) FILTER(WHERE d.antiguos[r.opcion+1]*1.0/d.na<d.nuevos[r.opcion+1]*1.0/d.nn)
    INTO suizo,latino FROM decisivas d JOIN suizamente_social.respuestas r ON r.pregunta=d.pregunta_id AND r.jugador=p_jugador;
  medallas:=suizamente_social.logros(p_jugador);
  RETURN jsonb_build_object('id',j.id,'usuarioId',j.usuario_id,'apodo',j.apodo,'color',j.color,'pais',j.pais,'canton',j.canton,'anosSuiza',j.anos_suiza,
    'enRanking',j.en_ranking,'ajustes',j.ajustes,'puntos',puntos,'nivel',nivel,'nombreNivel',nombres[nivel],
    'siguiente',CASE WHEN nivel<6 THEN nombres[nivel+1] END,'faltan',CASE WHEN nivel<6 THEN niveles[nivel+1]-puntos ELSE 0 END,
    'progreso',CASE WHEN nivel=6 THEN 100 ELSE round(100.0*(puntos-niveles[nivel])/(niveles[nivel+1]-niveles[nivel]))::int END,
    'racha',suizamente_social.racha(p_jugador),'aciertosSeguidos',CASE WHEN j.ultimo_acierto>now()-interval '30 minutes' THEN j.aciertos_seguidos ELSE 0 END,
    'datos',total,'reales',reales,'correctas',buenas,'aciertos',CASE WHEN reales>0 THEN round(100.0*buenas/reales)::int ELSE 0 END,
    'temas',temas,'suizometro',CASE WHEN suizo+latino>=10 THEN round(100.0*suizo/(suizo+latino))::int END,'decisivos',suizo+latino,
    'medallas',medallas,'admin',EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=j.usuario_id));
END $$;

CREATE OR REPLACE FUNCTION suizamente_social.diario(p_fecha date) RETURNS text[]
LANGUAGE plpgsql SET search_path=pg_catalog,public,suizamente_social AS $$
DECLARE ids text[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('suizamente-dia:'||p_fecha));
  SELECT preguntas INTO ids FROM suizamente_social.dias WHERE fecha=p_fecha;
  IF ids IS NOT NULL THEN RETURN ids; END IF;
  SELECT array_agg(id ORDER BY md5(p_fecha::text||id)) INTO ids FROM (
    (SELECT q.id FROM suizamente_social.preguntas q WHERE q.tipo='real'
      AND NOT EXISTS(SELECT 1 FROM suizamente_social.dias d WHERE d.fecha BETWEEN p_fecha-90 AND p_fecha-1 AND q.id=ANY(d.preguntas)) ORDER BY md5(p_fecha::text||q.id) LIMIT 3)
    UNION ALL
    (SELECT q.id FROM suizamente_social.preguntas q WHERE q.tipo='dilema' AND q.opciones=2
      AND NOT EXISTS(SELECT 1 FROM suizamente_social.dias d WHERE d.fecha BETWEEN p_fecha-90 AND p_fecha-1 AND q.id=ANY(d.preguntas)) ORDER BY md5(p_fecha::text||q.id) LIMIT 2)
  ) seleccion;
  IF cardinality(ids)<>5 THEN RAISE SQLSTATE 'PT503' USING MESSAGE='No hay preguntas suficientes para el reto'; END IF;
  INSERT INTO suizamente_social.dias VALUES(p_fecha,ids);
  RETURN ids;
END $$;

CREATE OR REPLACE FUNCTION suizamente_social.duelo(p_jugador text,p_codigo text) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,public,suizamente_social AS $$
DECLARE d suizamente_social.duelos; a jsonb; b jsonb; ca integer; cb integer; propio boolean; puntos_a integer; puntos_b integer;
BEGIN
  SELECT * INTO d FROM suizamente_social.duelos WHERE codigo=p_codigo FOR UPDATE;
  IF d.codigo IS NULL THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Duelo no encontrado'; END IF;
  IF d.estado='esperando' AND d.caduca_en<=now() THEN
    UPDATE suizamente_social.duelos SET estado='caducado' WHERE codigo=p_codigo; d.estado:='caducado';
  END IF;
  propio:=p_jugador IN(d.creador,d.rival);
  SELECT count(*),coalesce(sum(punto),0),coalesce(jsonb_object_agg(pregunta,jsonb_build_object('opcion',opcion,'punto',punto)),'{}')
    INTO ca,puntos_a,a FROM suizamente_social.duelo_respuestas WHERE codigo=p_codigo AND jugador=d.creador;
  SELECT count(*),coalesce(sum(punto),0),coalesce(jsonb_object_agg(pregunta,jsonb_build_object('opcion',opcion,'punto',punto)),'{}')
    INTO cb,puntos_b,b FROM suizamente_social.duelo_respuestas WHERE codigo=p_codigo AND jugador=d.rival;
  RETURN jsonb_build_object('codigo',d.codigo,'modo',d.modo,'estado',d.estado,'caducaEn',d.caduca_en,
    'creador', (SELECT jsonb_build_object('id',id,'apodo',apodo,'color',color) FROM suizamente_social.jugadores WHERE id=d.creador),
    'rival', (SELECT jsonb_build_object('id',CASE WHEN usuario_id IS NOT NULL OR id=p_jugador THEN id END,'apodo',apodo,'color',color) FROM suizamente_social.jugadores WHERE id=d.rival),
    'participante',coalesce(propio,false),'puedeUnirse',d.estado='esperando' AND d.rival IS NULL AND p_jugador<>d.creador AND (d.invitado IS NULL OR d.invitado=p_jugador),
    'preguntas',CASE WHEN propio THEN to_jsonb(d.preguntas) ELSE '[]'::jsonb END,
    'respondidas',CASE WHEN p_jugador=d.creador THEN ca WHEN p_jugador=d.rival THEN cb ELSE 0 END,
    'mias',CASE WHEN p_jugador=d.creador THEN a WHEN p_jugador=d.rival THEN b ELSE '{}'::jsonb END,
    'puntosCreador',CASE WHEN propio AND ca=10 AND cb=10 THEN puntos_a END,
    'puntosRival',CASE WHEN propio AND ca=10 AND cb=10 THEN puntos_b END,
    'respuestasCreador',CASE WHEN propio AND ca=10 AND cb=10 THEN a ELSE '{}'::jsonb END,
    'respuestasRival',CASE WHEN propio AND ca=10 AND cb=10 THEN b ELSE '{}'::jsonb END);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA suizamente_social FROM PUBLIC,anon,authenticated;

-- 04-api

CREATE OR REPLACE FUNCTION public.suizamente_social_api(p_accion text,p_jugador text,p_datos jsonb DEFAULT '{}',p_direccion text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,suizamente_social AS $$
#variable_conflict use_column
<<social_api>>
DECLARE
  j suizamente_social.jugadores; q suizamente_social.preguntas; d suizamente_social.duelos;
  uid uuid; nombre text; canton_latido text; invitado text; destino text; codigo text;
  hoy date:=suizamente_social.hoy(); inicio timestamptz:=(date_trunc('week',now() AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich');
  fin timestamptz:=((date_trunc('week',now() AT TIME ZONE 'Europe/Zurich')+interval '7 days') AT TIME ZONE 'Europe/Zurich');
  ids text[]; resultado jsonb; anterior jsonb; perfil jsonb; filas jsonb; detalle jsonb;
  antes integer; despues integer; n integer; a integer; b integer; opcion integer; punto integer; contador integer; nota integer;
  clave text; ref text; tipo text; modo text; item record; es_admin boolean; revancha boolean:=false;
BEGIN
  IF p_jugador IS NULL OR p_jugador !~ '^(user|anon):[a-f0-9-]{36}$' OR p_direccion IS NULL OR jsonb_typeof(p_datos)<>'object' THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE='Solicitud no válida';
  END IF;
  FOREACH clave IN ARRAY ARRAY['ip:'||p_direccion,p_jugador] LOOP
    INSERT INTO suizamente_social.limites AS l VALUES(clave,date_trunc('minute',now()),1)
    ON CONFLICT(clave) DO UPDATE SET ventana=excluded.ventana,
      cantidad=CASE WHEN l.ventana=excluded.ventana THEN l.cantidad+1 ELSE 1 END RETURNING cantidad INTO contador;
    IF contador>60 THEN RAISE SQLSTATE 'PT429' USING MESSAGE='Demasiadas peticiones'; END IF;
  END LOOP;
  DELETE FROM suizamente_social.limites WHERE ventana<now()-interval '1 day';
  IF p_jugador LIKE 'user:%' THEN
    uid:=substring(p_jugador FROM 6)::uuid;
    IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid) OR EXISTS(SELECT 1 FROM public.profiles WHERE id=uid AND banned) THEN
      RAISE SQLSTATE 'PT403' USING MESSAGE='Cuenta no disponible';
    END IF;
    SELECT coalesce(nullif(trim(p.name),''),nullif(trim(u.raw_user_meta_data->>'name'),''),'Usuario de Latido'),p.canton
      INTO nombre,canton_latido FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id WHERE u.id=uid;
    SELECT c.codigo INTO canton_latido FROM suizamente_social.cantones c
      WHERE lower(canton_latido) IN(lower(c.codigo),lower(c.nombre),lower(c.alias));
  END IF;
  INSERT INTO suizamente_social.jugadores(id,usuario_id,apodo,canton,perfil_iniciado)
    VALUES(p_jugador,uid,coalesce(nombre,'Invitado'),canton_latido,true)
    ON CONFLICT(id) DO UPDATE SET apodo=CASE WHEN uid IS NOT NULL THEN excluded.apodo ELSE suizamente_social.jugadores.apodo END,
      canton=CASE WHEN suizamente_social.jugadores.perfil_iniciado THEN suizamente_social.jugadores.canton ELSE excluded.canton END,perfil_iniciado=true;
  SELECT * INTO j FROM suizamente_social.jugadores WHERE id=p_jugador FOR UPDATE;
  es_admin:=uid IS NOT NULL AND EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=uid);

  -- Importa las respuestas existentes con su fecha original. Nunca vuelve a premiarlas.
  FOR item IN SELECT v.* FROM public.suizamente_votos v JOIN suizamente_social.preguntas sq ON sq.id=v.pregunta_id
    WHERE v.jugador_id=p_jugador AND NOT EXISTS(SELECT 1 FROM suizamente_social.respuestas r WHERE r.jugador=p_jugador AND r.pregunta=v.pregunta_id)
    ORDER BY v.creado_en,v.pregunta_id LOOP
    PERFORM suizamente_social.registrar(p_jugador,item.pregunta_id,item.opcion,item.creado_en);
  END LOOP;

  IF p_accion='perfil_guardar' THEN
    IF p_datos?'enRanking' AND jsonb_typeof(p_datos->'enRanking')<>'boolean' THEN
      RAISE SQLSTATE 'PT400' USING MESSAGE='Revisa los ajustes de privacidad';
    END IF;
    IF p_datos?'ajustes' THEN
      IF jsonb_typeof(p_datos->'ajustes')<>'object' THEN
        RAISE SQLSTATE 'PT400' USING MESSAGE='Revisa los ajustes';
      END IF;
      IF EXISTS(SELECT 1 FROM jsonb_each(p_datos->'ajustes') e WHERE
        e.key NOT IN ('apariencia','sonidos','vibracion','menosAnimaciones','avisos')
        OR (e.key='apariencia' AND (jsonb_typeof(e.value)<>'string' OR e.value#>>'{}' NOT IN ('auto','light','dark')))
        OR (e.key<>'apariencia' AND jsonb_typeof(e.value)<>'boolean')) THEN
        RAISE SQLSTATE 'PT400' USING MESSAGE='Revisa los ajustes';
      END IF;
    END IF;
    IF uid IS NULL AND (length(trim(p_datos->>'apodo')) NOT BETWEEN 2 AND 40 OR (p_datos->>'apodo') !~ '^[[:alnum:] ._-]+$') THEN
      RAISE SQLSTATE 'PT400' USING MESSAGE='Revisa el nombre del perfil';
    END IF;
    UPDATE suizamente_social.jugadores SET
      apodo=CASE WHEN uid IS NULL THEN coalesce(nullif(trim(p_datos->>'apodo'),''),apodo) ELSE apodo END,
      color=coalesce(p_datos->>'color',color),pais=CASE WHEN p_datos?'pais' THEN nullif(p_datos->>'pais','') ELSE pais END,
      canton=CASE WHEN p_datos?'canton' THEN nullif(p_datos->>'canton','') ELSE canton END,anos_suiza=CASE WHEN p_datos?'anosSuiza' THEN nullif(p_datos->>'anosSuiza','') ELSE anos_suiza END,
      en_ranking=coalesce((p_datos->>'enRanking')::boolean,en_ranking),
      ajustes=ajustes||(coalesce(p_datos->'ajustes','{}')-ARRAY['puntos','admin','usuarioId'])
      WHERE id=p_jugador;
    RETURN jsonb_build_object('perfil',suizamente_social.perfil(p_jugador));
  ELSIF p_accion='vincular' THEN
    IF uid IS NULL THEN RAISE SQLSTATE 'PT401' USING MESSAGE='Entra con tu cuenta de Latido'; END IF;
    invitado:='anon:'||(p_datos->>'invitado');
    IF invitado !~ '^anon:[a-f0-9-]{36}$' THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Invitado no válido'; END IF;
    IF NOT EXISTS(SELECT 1 FROM suizamente_social.jugadores WHERE id=invitado)
      AND EXISTS(SELECT 1 FROM public.suizamente_votos WHERE jugador_id=invitado) THEN
      INSERT INTO suizamente_social.jugadores(id) VALUES(invitado);
      FOR item IN SELECT v.* FROM public.suizamente_votos v JOIN suizamente_social.preguntas q ON q.id=v.pregunta_id
        WHERE v.jugador_id=invitado ORDER BY v.creado_en,v.pregunta_id LOOP
        PERFORM suizamente_social.registrar(invitado,item.pregunta_id,item.opcion,item.creado_en);
      END LOOP;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM suizamente_social.jugadores WHERE id=invitado) THEN
      RETURN jsonb_build_object('perfil',suizamente_social.perfil(p_jugador),'vinculado',false);
    END IF;
    PERFORM 1 FROM suizamente_social.jugadores WHERE id=invitado FOR UPDATE;
    -- Primero conserva el voto que ya tenía la cuenta; después incorpora los que faltan.
    DELETE FROM public.suizamente_votos g USING public.suizamente_votos a
      WHERE g.jugador_id=invitado AND a.jugador_id=p_jugador AND a.pregunta_id=g.pregunta_id;
    UPDATE public.suizamente_votos SET jugador_id=p_jugador,usuario_id=uid WHERE jugador_id=invitado;
    INSERT INTO suizamente_social.respuestas SELECT p_jugador,pregunta,opcion,acierto,canton,creado_en FROM suizamente_social.respuestas WHERE jugador=invitado ON CONFLICT DO NOTHING;
    INSERT INTO suizamente_social.puntos SELECT p_jugador,motivo,ref,cantidad,canton,creado_en FROM suizamente_social.puntos WHERE jugador=invitado ON CONFLICT DO NOTHING;
    INSERT INTO suizamente_social.diarias SELECT fecha,p_jugador,pregunta,opcion,acierto,creado_en FROM suizamente_social.diarias WHERE jugador=invitado ON CONFLICT DO NOTHING;
    INSERT INTO suizamente_social.libreta SELECT p_jugador,pregunta,creado_en FROM suizamente_social.libreta WHERE jugador=invitado ORDER BY creado_en DESC
      LIMIT greatest(0,500-(SELECT count(*)::int FROM suizamente_social.libreta WHERE jugador=p_jugador)) ON CONFLICT DO NOTHING;
    -- Una cuenta no puede convertirse en su propia rival al vincular un invitado.
    DELETE FROM suizamente_social.puntos WHERE motivo='duelo' AND ref IN(SELECT codigo FROM suizamente_social.duelos
      WHERE (creador=invitado AND rival=p_jugador) OR (creador=p_jugador AND rival=invitado));
    DELETE FROM suizamente_social.duelos WHERE (creador=invitado AND rival=p_jugador) OR (creador=p_jugador AND rival=invitado);
    INSERT INTO suizamente_social.duelo_respuestas SELECT codigo,p_jugador,pregunta,opcion,punto,creado_en FROM suizamente_social.duelo_respuestas WHERE jugador=invitado ON CONFLICT DO NOTHING;
    UPDATE suizamente_social.duelos SET rival=p_jugador WHERE rival=invitado;
    UPDATE suizamente_social.duelos SET creador=p_jugador WHERE creador=invitado;
    UPDATE suizamente_social.jugadores a SET pais=coalesce(a.pais,g.pais),canton=coalesce(a.canton,g.canton),anos_suiza=coalesce(a.anos_suiza,g.anos_suiza)
      ,ajustes=g.ajustes||a.ajustes,en_ranking=a.en_ranking AND g.en_ranking
      FROM suizamente_social.jugadores g WHERE a.id=p_jugador AND g.id=invitado;
    DELETE FROM suizamente_social.jugadores WHERE id=invitado;
    RETURN jsonb_build_object('perfil',suizamente_social.perfil(p_jugador),'vinculado',true);
  ELSIF p_accion='respuesta' THEN
    SELECT * INTO q FROM suizamente_social.preguntas WHERE id=p_datos->>'preguntaId';
    opcion:=(p_datos->>'opcion')::integer;
    IF q.id IS NULL OR opcion IS NULL OR opcion<0 OR opcion>=q.opciones THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Pregunta u opción no válida'; END IF;
    tipo:=p_datos->'contexto'->>'tipo';
    IF tipo='reto' THEN
      IF p_datos->'contexto'->>'fecha'<>hoy::text THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Este reto ya ha terminado'; END IF;
      ids:=suizamente_social.diario(hoy);
      IF NOT q.id=ANY(ids) THEN RAISE SQLSTATE 'PT400' USING MESSAGE='La pregunta no pertenece a este reto'; END IF;
    ELSIF tipo='duelo' THEN
      codigo:=p_datos->'contexto'->>'codigo';
      SELECT * INTO d FROM suizamente_social.duelos WHERE suizamente_social.duelos.codigo=social_api.codigo FOR UPDATE;
      IF d.codigo IS NULL OR NOT coalesce(p_jugador IN(d.creador,d.rival),false) THEN RAISE SQLSTATE 'PT403' USING MESSAGE='No participas en este duelo'; END IF;
      IF d.estado='caducado' OR (d.estado='esperando' AND d.caduca_en<=now()) THEN RAISE SQLSTATE 'PT409' USING MESSAGE='El duelo ha caducado'; END IF;
      IF NOT q.id=ANY(d.preguntas) THEN RAISE SQLSTATE 'PT400' USING MESSAGE='La pregunta no pertenece al duelo'; END IF;
    ELSIF tipo IS NOT NULL THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Contexto no válido'; END IF;
    SELECT coalesce(sum(cantidad),0) INTO antes FROM suizamente_social.puntos WHERE jugador=p_jugador;
    anterior:=suizamente_social.perfil(p_jugador);
    resultado:=public.suizamente_votos_api('votar',p_jugador,q.id,opcion,'social:'||p_direccion);
    PERFORM suizamente_social.registrar(p_jugador,q.id,(resultado->>'opcion')::int);
    IF tipo='reto' THEN
      INSERT INTO suizamente_social.diarias VALUES(hoy,p_jugador,q.id,opcion,CASE WHEN q.tipo='real' THEN opcion=q.correcta END,now()) ON CONFLICT DO NOTHING;
      IF (SELECT count(*) FROM suizamente_social.diarias WHERE fecha=hoy AND jugador=p_jugador)=5 THEN
        PERFORM suizamente_social.sumar(p_jugador,'reto',hoy::text,30,j.canton);
      END IF;
    ELSIF tipo='duelo' THEN
      IF q.tipo='real' THEN punto:=CASE WHEN opcion=q.correcta THEN 1 ELSE 0 END;
      ELSE
        -- El empate también es mayoría, pero no se inventa una mayoría con un único voto.
        SELECT CASE WHEN sum(c)>1 AND max(c)=(SELECT count(*) FROM public.suizamente_votos WHERE pregunta_id=q.id AND suizamente_votos.opcion=social_api.opcion) THEN 1 ELSE 0 END
          INTO punto FROM (SELECT count(*) c FROM public.suizamente_votos WHERE pregunta_id=q.id GROUP BY suizamente_votos.opcion) v;
      END IF;
      INSERT INTO suizamente_social.duelo_respuestas VALUES(codigo,p_jugador,q.id,opcion,punto,now()) ON CONFLICT DO NOTHING;
      IF (SELECT count(*) FROM suizamente_social.duelo_respuestas r WHERE r.codigo=d.codigo)=20 THEN
        UPDATE suizamente_social.duelos SET estado='terminado',terminado_en=now() WHERE suizamente_social.duelos.codigo=d.codigo;
        SELECT sum(r.punto) FILTER(WHERE r.jugador=d.creador),sum(r.punto) FILTER(WHERE r.jugador=d.rival)
          INTO a,b FROM suizamente_social.duelo_respuestas r WHERE r.codigo=d.codigo;
        PERFORM suizamente_social.sumar(d.creador,'duelo',d.codigo,CASE WHEN a>b THEN 20 WHEN a=b THEN 10 ELSE 0 END,(SELECT canton FROM suizamente_social.jugadores WHERE id=d.creador));
        PERFORM suizamente_social.sumar(d.rival,'duelo',d.codigo,CASE WHEN b>a THEN 20 WHEN a=b THEN 10 ELSE 0 END,(SELECT canton FROM suizamente_social.jugadores WHERE id=d.rival));
        IF d.estado<>'terminado' THEN
          PERFORM suizamente_social.notificar(d.creador,'duelo:'||d.codigo,'Duelo terminado','Ya puedes ver el resultado.','/suizamente/duelo/'||d.codigo);
          PERFORM suizamente_social.notificar(d.rival,'duelo:'||d.codigo,'Duelo terminado','Ya puedes ver el resultado.','/suizamente/duelo/'||d.codigo);
        END IF;
      END IF;
    END IF;
    perfil:=suizamente_social.perfil(p_jugador);
    despues:=(perfil->>'puntos')::int;
    SELECT coalesce(jsonb_agg(m),'[]') INTO detalle FROM jsonb_array_elements(perfil->'medallas') m
      WHERE (m->>'conseguida')::boolean AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(anterior->'medallas') am WHERE am->>'id'=m->>'id' AND (am->>'conseguida')::boolean);
    RETURN resultado||jsonb_build_object('puntos',despues-antes,'perfil',perfil,'medallasNuevas',detalle,'nivelNuevo',(perfil->>'nivel')::int>(anterior->>'nivel')::int);
  ELSIF p_accion='reto' THEN
    ids:=suizamente_social.diario(hoy);
    SELECT coalesce(jsonb_object_agg(pregunta,opcion),'{}') INTO detalle FROM suizamente_social.diarias WHERE fecha=hoy AND jugador=p_jugador;
    SELECT coalesce(jsonb_agg(EXISTS(SELECT 1 FROM suizamente_social.diarias WHERE jugador=p_jugador AND fecha=(inicio AT TIME ZONE 'Europe/Zurich')::date+i GROUP BY fecha HAVING count(*)=5) ORDER BY i),'[]')
      INTO filas FROM generate_series(0,6) i;
    SELECT jsonb_build_object('aciertos',count(*) FILTER(WHERE acierto),'hecho',count(*)=5) INTO anterior FROM suizamente_social.diarias WHERE fecha=hoy-1 AND jugador=p_jugador;
    SELECT CASE WHEN count(*)>0 THEN round(100.0*count(*) FILTER(WHERE t.aciertos<(anterior->>'aciertos')::int)/count(*))::int END INTO n
      FROM (SELECT jugador,count(*) FILTER(WHERE acierto) aciertos FROM suizamente_social.diarias WHERE fecha=hoy-1 GROUP BY jugador HAVING count(*)=5) t;
    SELECT count(*) FILTER(WHERE acierto) INTO nota FROM suizamente_social.diarias WHERE fecha=hoy AND jugador=p_jugador;
    RETURN jsonb_build_object('fecha',hoy,'preguntas',ids,'respuestas',detalle,'aciertos',nota,'hecho',(SELECT count(*) FROM jsonb_object_keys(detalle))=5,
      'terminaEn',((hoy+1)::timestamp AT TIME ZONE 'Europe/Zurich'),'semana',filas,'ayer',anterior||jsonb_build_object('mejorQuePct',n));
  ELSIF p_accion IN('duelos','duelo','duelo_unirse','duelo_crear','duelo_revancha') THEN
    IF p_accion='duelo_revancha' THEN
      SELECT * INTO d FROM suizamente_social.duelos WHERE codigo=upper(p_datos->>'codigo') FOR UPDATE;
      IF d.codigo IS NULL OR NOT coalesce(p_jugador IN(d.creador,d.rival),false) THEN RAISE SQLSTATE 'PT403' USING MESSAGE='No participas en este duelo'; END IF;
      IF d.estado<>'terminado' THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Primero terminad el duelo'; END IF;
      destino:=CASE WHEN d.creador=p_jugador THEN d.rival ELSE d.creador END;
      IF destino IS NULL THEN RAISE SQLSTATE 'PT404' USING MESSAGE='El rival ya no está disponible'; END IF;
      p_datos:=jsonb_build_object('modo',d.modo,'rival',destino);p_accion:='duelo_crear';revancha:=true;
    END IF;
    IF p_accion='duelos' THEN
      SELECT coalesce(jsonb_agg(suizamente_social.duelo(p_jugador,t.codigo) ORDER BY t.creado_en DESC),'[]') INTO filas
        FROM (SELECT * FROM suizamente_social.duelos WHERE p_jugador IN(creador,rival,invitado) ORDER BY creado_en DESC LIMIT 50) t;
      RETURN jsonb_build_object('duelos',filas);
    ELSIF p_accion='duelo_crear' THEN
      IF uid IS NULL THEN RAISE SQLSTATE 'PT401' USING MESSAGE='Entra con tu cuenta para retar'; END IF;
      IF (SELECT count(*) FROM suizamente_social.duelos WHERE creador=p_jugador AND estado='esperando' AND caduca_en>now())>=10 THEN RAISE SQLSTATE 'PT429' USING MESSAGE='Tienes diez duelos abiertos'; END IF;
      modo:=p_datos->>'modo';
      IF modo IS NULL OR modo NOT IN('dilemas','preguntas','mix') THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Elige un modo de juego'; END IF;
      destino:=nullif(p_datos->>'rival','');
      IF destino IS NOT NULL AND EXISTS(SELECT 1 FROM suizamente_social.amistades WHERE estado='bloqueada' AND p_jugador IN(solicitante,destinatario) AND destino IN(solicitante,destinatario)) THEN RAISE SQLSTATE 'PT403' USING MESSAGE='El duelo no está disponible'; END IF;
      IF destino IS NOT NULL AND NOT revancha AND NOT EXISTS(SELECT 1 FROM suizamente_social.amistades WHERE estado='aceptada' AND p_jugador IN(solicitante,destinatario) AND destino IN(solicitante,destinatario) AND destino<>p_jugador) THEN
        RAISE SQLSTATE 'PT403' USING MESSAGE='Elige una amistad aceptada o comparte el enlace';
      END IF;
      SELECT array_agg(id ORDER BY random()) INTO ids FROM (
        (SELECT id FROM suizamente_social.preguntas WHERE tipo='dilema' AND opciones=2 AND modo IN('dilemas','mix') ORDER BY random() LIMIT CASE WHEN modo='mix' THEN 5 ELSE 10 END)
        UNION ALL (SELECT id FROM suizamente_social.preguntas WHERE tipo='real' AND modo IN('preguntas','mix') ORDER BY random() LIMIT CASE WHEN modo='mix' THEN 5 ELSE 10 END)
      ) t;
      codigo:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      INSERT INTO suizamente_social.duelos(codigo,modo,preguntas,creador,invitado) VALUES(codigo,modo,ids,p_jugador,destino);
      IF destino IS NOT NULL THEN PERFORM suizamente_social.notificar(destino,'reto:'||codigo,'Te han retado',j.apodo||' quiere jugar contigo.','/suizamente/duelo/'||codigo); END IF;
      RETURN suizamente_social.duelo(p_jugador,codigo);
    ELSE
      codigo:=upper(p_datos->>'codigo');
      IF p_accion='duelo_unirse' THEN
        SELECT * INTO d FROM suizamente_social.duelos WHERE suizamente_social.duelos.codigo=social_api.codigo FOR UPDATE;
        IF d.codigo IS NULL THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Duelo no encontrado'; END IF;
        IF d.creador=p_jugador OR (d.rival IS NOT NULL AND d.rival<>p_jugador) OR (d.invitado IS NOT NULL AND d.invitado<>p_jugador) THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Este duelo no está disponible para esta cuenta'; END IF;
        IF d.caduca_en<=now() OR d.estado<>'esperando' THEN RAISE SQLSTATE 'PT409' USING MESSAGE='El duelo ya ha terminado'; END IF;
        UPDATE suizamente_social.duelos SET rival=p_jugador WHERE suizamente_social.duelos.codigo=social_api.codigo;
      END IF;
      RETURN suizamente_social.duelo(p_jugador,codigo);
    END IF;
  ELSIF p_accion='ranking' THEN
    tipo:=coalesce(p_datos->>'tipo','cantones');
    IF tipo='cantones' THEN
      WITH elegibles AS (SELECT id FROM suizamente_social.jugadores WHERE usuario_id IS NOT NULL AND en_ranking),
      actividad AS (
        SELECT r.canton,r.jugador FROM suizamente_social.respuestas r JOIN elegibles e ON e.id=r.jugador WHERE r.creado_en>=inicio AND r.creado_en<fin
        UNION SELECT p.canton,p.jugador FROM suizamente_social.puntos p JOIN elegibles e ON e.id=p.jugador WHERE p.creado_en>=inicio AND p.creado_en<fin AND p.cantidad>0
      ), activos AS (SELECT canton,count(DISTINCT jugador) n FROM actividad GROUP BY canton),
      totales AS (SELECT p.canton,sum(cantidad) puntos FROM suizamente_social.puntos p JOIN elegibles e ON e.id=p.jugador WHERE p.creado_en>=inicio AND p.creado_en<fin GROUP BY p.canton),
      datos AS (SELECT c.codigo,c.nombre,coalesce(t.puntos,0) puntos,coalesce(a.n,0) activos,
        CASE WHEN a.n>0 THEN round(coalesce(t.puntos,0)*1.0/a.n,2) ELSE 0 END media
        FROM suizamente_social.cantones c LEFT JOIN activos a ON a.canton=c.codigo LEFT JOIN totales t ON t.canton=c.codigo),
      orden AS (SELECT *,CASE WHEN activos>0 THEN dense_rank() OVER(ORDER BY (activos>0) DESC,media DESC) END puesto FROM datos)
      SELECT jsonb_agg(to_jsonb(o) ORDER BY (activos>0) DESC,media DESC,nombre) INTO filas FROM orden o;
      SELECT coalesce(sum(cantidad),0) INTO n FROM suizamente_social.puntos WHERE jugador=p_jugador AND creado_en>=inicio AND creado_en<fin AND canton=j.canton;
      RETURN jsonb_build_object('filas',filas,'miCanton',j.canton,'aporte',n,'inicio',inicio,'fin',fin,'criterio','media_por_jugador_activo');
    ELSIF tipo IN('semana','amigos') THEN
      WITH datos AS (
        SELECT g.id,g.apodo,g.color,g.canton,coalesce(sum(p.cantidad) FILTER(WHERE p.creado_en>=inicio AND p.creado_en<fin),0)::int puntos
        FROM suizamente_social.jugadores g LEFT JOIN suizamente_social.puntos p ON p.jugador=g.id
        WHERE g.usuario_id IS NOT NULL AND g.en_ranking AND g.perfil_iniciado AND (tipo='semana' OR g.id=p_jugador OR EXISTS(SELECT 1 FROM suizamente_social.amistades a WHERE a.estado='aceptada' AND p_jugador IN(a.solicitante,a.destinatario) AND g.id IN(a.solicitante,a.destinatario)))
        GROUP BY g.id
      ), orden AS(SELECT *,dense_rank() OVER(ORDER BY puntos DESC) puesto FROM datos)
      SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY puesto,apodo),'[]') INTO filas FROM orden o WHERE puesto<=50 OR id=p_jugador;
      RETURN jsonb_build_object('filas',filas,'yo',p_jugador,'fin',fin);
    END IF;
    RAISE SQLSTATE 'PT400' USING MESSAGE='Clasificación no válida';
  ELSIF p_accion IN('amigos','amigo_solicitar','amigo_responder','amigo_quitar','buscar') THEN
    IF uid IS NULL THEN RAISE SQLSTATE 'PT401' USING MESSAGE='Entra con tu cuenta para agregar amigos'; END IF;
    IF p_accion='buscar' THEN
      ref:=trim(p_datos->>'texto');
      IF length(ref)<2 OR length(ref)>80 THEN RETURN jsonb_build_object('personas','[]'::jsonb); END IF;
      SELECT coalesce(jsonb_agg(t),'[]') INTO filas FROM (
        SELECT 'user:'||p.id id,p.name apodo,coalesce(g.color,'menta') color,p.canton
        FROM public.profiles p LEFT JOIN suizamente_social.jugadores g ON g.usuario_id=p.id
        WHERE p.id<>uid AND NOT coalesce(p.banned,false) AND position(lower(ref) IN lower(p.name))>0
          AND NOT EXISTS(SELECT 1 FROM suizamente_social.amistades a WHERE a.estado='bloqueada' AND p_jugador IN(a.solicitante,a.destinatario) AND 'user:'||p.id IN(a.solicitante,a.destinatario))
        ORDER BY p.name LIMIT 20) t;
      RETURN jsonb_build_object('personas',filas);
    ELSIF p_accion<>'amigos' THEN
      destino:=p_datos->>'id';
      IF destino IS NULL OR destino=p_jugador OR destino !~ '^user:[a-f0-9-]{36}$' THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Persona no válida'; END IF;
      IF p_accion='amigo_solicitar' THEN
        IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=substring(destino FROM 6)::uuid AND NOT coalesce(banned,false)) THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Persona no disponible'; END IF;
        INSERT INTO suizamente_social.jugadores(id,usuario_id,apodo) SELECT destino,id,name FROM public.profiles WHERE id=substring(destino FROM 6)::uuid ON CONFLICT DO NOTHING;
        IF EXISTS(SELECT 1 FROM suizamente_social.amistades WHERE estado='bloqueada' AND p_jugador IN(solicitante,destinatario) AND destino IN(solicitante,destinatario)) THEN RAISE SQLSTATE 'PT403' USING MESSAGE='Solicitud no disponible'; END IF;
        INSERT INTO suizamente_social.amistades(solicitante,destinatario) VALUES(p_jugador,destino) ON CONFLICT DO NOTHING;
        GET DIAGNOSTICS n=ROW_COUNT;
        IF n>0 THEN PERFORM suizamente_social.notificar(destino,'amistad:'||p_jugador,'Solicitud de amistad',j.apodo||' quiere agregarte.','/suizamente/amigos'); END IF;
      ELSIF p_accion='amigo_responder' THEN
        IF p_datos->>'respuesta'='aceptar' THEN
          UPDATE suizamente_social.amistades SET estado='aceptada' WHERE solicitante=destino AND destinatario=p_jugador AND estado='pendiente';
        ELSIF p_datos->>'respuesta'='bloquear' THEN
          DELETE FROM suizamente_social.amistades WHERE p_jugador IN(solicitante,destinatario) AND destino IN(solicitante,destinatario) AND (estado<>'bloqueada' OR solicitante=p_jugador);
          INSERT INTO suizamente_social.amistades VALUES(p_jugador,destino,'bloqueada',now()) ON CONFLICT DO NOTHING;
        ELSE DELETE FROM suizamente_social.amistades WHERE solicitante=destino AND destinatario=p_jugador AND estado='pendiente'; END IF;
      ELSE DELETE FROM suizamente_social.amistades WHERE p_jugador IN(solicitante,destinatario) AND destino IN(solicitante,destinatario) AND (estado<>'bloqueada' OR solicitante=p_jugador); END IF;
    END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',g.id,'apodo',g.apodo,'color',g.color,'canton',g.canton,'estado',a.estado,'recibida',a.destinatario=p_jugador)),'[]') INTO filas
      FROM suizamente_social.amistades a JOIN suizamente_social.jugadores g ON g.id=CASE WHEN a.solicitante=p_jugador THEN a.destinatario ELSE a.solicitante END
      WHERE p_jugador IN(a.solicitante,a.destinatario) AND a.estado<>'bloqueada';
    RETURN jsonb_build_object('amistades',filas);
  ELSIF p_accion IN('libreta','libreta_guardar','libreta_quitar') THEN
    IF p_accion='libreta_guardar' THEN
      IF (SELECT count(*) FROM suizamente_social.libreta WHERE jugador=p_jugador)>=500 AND NOT EXISTS(SELECT 1 FROM suizamente_social.libreta WHERE jugador=p_jugador AND pregunta=p_datos->>'preguntaId') THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Tu libreta admite 500 datos'; END IF;
      INSERT INTO suizamente_social.libreta VALUES(p_jugador,p_datos->>'preguntaId',now()) ON CONFLICT DO NOTHING;
    ELSIF p_accion='libreta_quitar' THEN DELETE FROM suizamente_social.libreta WHERE jugador=p_jugador AND pregunta=p_datos->>'preguntaId'; END IF;
    SELECT coalesce(jsonb_agg(pregunta ORDER BY creado_en DESC),'[]') INTO filas FROM suizamente_social.libreta WHERE jugador=p_jugador;
    RETURN jsonb_build_object('libreta',filas);
  ELSIF p_accion IN('propuestas','propuesta_crear','moderar','moderacion','autores') THEN
    IF p_accion='autores' THEN
      SELECT coalesce(jsonb_object_agg(p.pregunta_id,coalesce(g.apodo,'Comunidad Latido')),'{}') INTO filas FROM suizamente_social.propuestas p LEFT JOIN suizamente_social.jugadores g ON g.id=p.jugador WHERE p.estado='publicada';
      RETURN jsonb_build_object('autores',filas);
    END IF;
    IF uid IS NULL THEN RAISE SQLSTATE 'PT401' USING MESSAGE='Entra con tu cuenta para proponer'; END IF;
    IF p_accion='propuesta_crear' THEN
      IF (SELECT count(*) FROM suizamente_social.propuestas WHERE jugador=p_jugador AND creado_en>=(hoy::timestamp AT TIME ZONE 'Europe/Zurich'))>=3 THEN RAISE SQLSTATE 'PT429' USING MESSAGE='Puedes enviar tres propuestas al día'; END IF;
      tipo:=p_datos->>'tipo'; detalle:=p_datos->'opciones';
      IF tipo NOT IN('dilema','real','mito','correccion') OR p_datos->>'tema' NOT IN('comida','casa','papeles','trabajo','dinero','salud','transporte','idioma','social','fiestas','naturaleza','cultura') THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Tipo o tema no válido'; END IF;
      IF tipo IN('real','dilema') THEN
        IF jsonb_typeof(detalle)<>'array' OR jsonb_array_length(detalle) NOT BETWEEN 2 AND 3 OR (tipo='dilema' AND jsonb_array_length(detalle)<>2)
          OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(detalle) o WHERE length(trim(o)) NOT BETWEEN 1 AND 90) THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Revisa las opciones'; END IF;
      END IF;
      IF tipo='real' AND ((p_datos->>'correcta')::int IS NULL OR (p_datos->>'correcta')::int NOT BETWEEN 0 AND jsonb_array_length(detalle)-1) THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Marca la respuesta correcta'; END IF;
      IF tipo='mito' AND p_datos->>'correcta' NOT IN('0','1') THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Marca verdad o mito'; END IF;
      INSERT INTO suizamente_social.propuestas(jugador,tipo,tema,pregunta,opciones,correcta,dato,fuente)
        VALUES(p_jugador,tipo,p_datos->>'tema',trim(p_datos->>'pregunta'),detalle,(p_datos->>'correcta')::smallint,trim(p_datos->>'dato'),nullif(trim(p_datos->>'fuente'),''));
    ELSIF p_accion IN('moderacion','moderar') THEN
      IF NOT es_admin THEN RAISE SQLSTATE 'PT403' USING MESSAGE='Solo el equipo de Latido puede moderar'; END IF;
      IF p_accion='moderar' THEN
        tipo:=p_datos->>'estado';
        IF tipo NOT IN('aprobada','rechazada','publicada') THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Estado no válido'; END IF;
        SELECT * INTO item FROM suizamente_social.propuestas WHERE id=(p_datos->>'id')::bigint FOR UPDATE;
        IF item.id IS NULL THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Propuesta no encontrada'; END IF;
        IF item.estado='publicada' THEN RAISE SQLSTATE 'PT409' USING MESSAGE='Esta propuesta ya está publicada'; END IF;
        IF p_datos?'contenido' THEN
          detalle:=p_datos->'contenido';
          IF jsonb_typeof(detalle)<>'object' THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Contenido no válido'; END IF;
          IF item.tipo IN('dilema','real') AND detalle?'opciones' THEN
            IF jsonb_typeof(detalle->'opciones')<>'array' THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Revisa las opciones'; END IF;
            IF jsonb_array_length(detalle->'opciones') NOT BETWEEN 2 AND 3
              OR (item.tipo='dilema' AND jsonb_array_length(detalle->'opciones')<>2)
              OR EXISTS(SELECT 1 FROM jsonb_array_elements(detalle->'opciones') o
                WHERE jsonb_typeof(o)<>'string' OR length(trim(o#>>'{}')) NOT BETWEEN 1 AND 90) THEN
              RAISE SQLSTATE 'PT400' USING MESSAGE='Revisa las opciones';
            END IF;
          END IF;
          opcion:=CASE WHEN detalle?'correcta' THEN (detalle->>'correcta')::int ELSE item.correcta END;
          IF (item.tipo='real' AND (opcion IS NULL OR opcion NOT BETWEEN 0 AND jsonb_array_length(coalesce(detalle->'opciones',item.opciones))-1))
            OR (item.tipo='mito' AND (opcion IS NULL OR opcion NOT IN(0,1))) THEN
            RAISE SQLSTATE 'PT400' USING MESSAGE='Revisa la respuesta correcta';
          END IF;
          UPDATE suizamente_social.propuestas SET pregunta=coalesce(trim(detalle->>'pregunta'),pregunta),
            dato=coalesce(trim(detalle->>'dato'),dato),fuente=CASE WHEN detalle?'fuente' THEN nullif(trim(detalle->>'fuente'),'') ELSE fuente END,
            opciones=CASE WHEN item.tipo IN('dilema','real') THEN coalesce(detalle->'opciones',opciones) ELSE opciones END,
            correcta=CASE WHEN item.tipo IN('real','mito') THEN opcion ELSE NULL END WHERE id=item.id;
        END IF;
        IF tipo='publicada' AND (item.estado<>'aprobada' OR NOT EXISTS(SELECT 1 FROM suizamente_social.preguntas WHERE id=p_datos->>'preguntaId')) THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Primero aprueba e incorpora la pregunta al banco'; END IF;
        UPDATE suizamente_social.propuestas SET estado=social_api.tipo,nota=left(p_datos->>'nota',500),pregunta_id=CASE WHEN social_api.tipo='publicada' THEN p_datos->>'preguntaId' END,revisado_en=now() WHERE id=item.id;
        IF tipo='publicada' AND item.jugador IS NOT NULL THEN
          PERFORM suizamente_social.sumar(item.jugador,'propuesta',item.id::text,100,(SELECT canton FROM suizamente_social.jugadores WHERE id=item.jugador));
          PERFORM suizamente_social.logros(item.jugador);
        END IF;
        PERFORM suizamente_social.notificar(item.jugador,'propuesta:'||item.id,'Tu propuesta ha sido revisada','Consulta el estado y la nota del equipo.','/suizamente/proponer');
      END IF;
      SELECT coalesce(jsonb_agg(t ORDER BY t.creado_en DESC),'[]') INTO filas FROM
        (SELECT p.*,g.apodo FROM suizamente_social.propuestas p LEFT JOIN suizamente_social.jugadores g ON g.id=p.jugador ORDER BY p.creado_en DESC LIMIT 100) t;
      RETURN jsonb_build_object('propuestas',filas);
    END IF;
    SELECT coalesce(jsonb_agg(to_jsonb(p)-'jugador' ORDER BY creado_en DESC),'[]') INTO filas FROM suizamente_social.propuestas p WHERE jugador=p_jugador;
    RETURN jsonb_build_object('propuestas',filas);
  ELSIF p_accion='desglose' THEN
    ref:=p_datos->>'preguntaId'; tipo:=coalesce(p_datos->>'por','pais');
    IF tipo NOT IN('pais','anos') THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Desglose no válido'; END IF;
    SELECT coalesce(jsonb_agg(t ORDER BY votos DESC),'[]') INTO filas FROM (
      SELECT CASE WHEN tipo='pais' THEN g.pais ELSE g.anos_suiza END grupo,count(*) votos,
        jsonb_build_array(count(*) FILTER(WHERE v.opcion=0),count(*) FILTER(WHERE v.opcion=1),count(*) FILTER(WHERE v.opcion=2)) conteos
      FROM public.suizamente_votos v JOIN suizamente_social.jugadores g ON g.id=v.jugador_id WHERE v.pregunta_id=ref
      AND (CASE WHEN tipo='pais' THEN g.pais ELSE g.anos_suiza END) IS NOT NULL
      GROUP BY grupo HAVING count(*)>=20) t;
    RETURN jsonb_build_object('grupos',filas,'tuGrupo',CASE WHEN tipo='pais' THEN j.pais ELSE j.anos_suiza END);
  ELSIF p_accion='comunidad' THEN
    SELECT jsonb_build_object('preguntaId',pregunta_id,'opcion',opcion,'pct',round(100.0*n/total)::int,'votos',total) INTO resultado FROM (
      SELECT v.pregunta_id,v.opcion,count(*) n,sum(count(*)) OVER(PARTITION BY v.pregunta_id) total,
        row_number() OVER(PARTITION BY v.pregunta_id ORDER BY count(*) DESC,v.opcion) puesto
      FROM public.suizamente_votos v JOIN suizamente_social.preguntas q ON q.id=v.pregunta_id
      WHERE q.tipo='dilema' AND q.opciones=2 AND v.creado_en>=now()-interval '24 hours' GROUP BY v.pregunta_id,v.opcion
    ) t WHERE total>=30 AND puesto=1 ORDER BY total DESC,pregunta_id LIMIT 1;
    RETURN jsonb_build_object('comunidad',resultado);
  ELSIF p_accion IN('avisos','avisos_leer') THEN
    IF uid IS NULL THEN RETURN jsonb_build_object('avisos','[]'::jsonb); END IF;
    IF p_accion='avisos_leer' THEN UPDATE public.app_notifications SET read_at=now() WHERE recipient_id=uid AND kind='suizamente' AND read_at IS NULL; END IF;
    SELECT coalesce(jsonb_agg(t ORDER BY t.created_at DESC),'[]') INTO filas FROM
      (SELECT id,data,created_at,read_at FROM public.app_notifications WHERE recipient_id=uid AND kind='suizamente' ORDER BY created_at DESC LIMIT 30) t;
    RETURN jsonb_build_object('avisos',filas);
  ELSIF p_accion='borrar' THEN
    IF p_datos->>'confirmacion'<>'BORRAR' OR NOT coalesce((p_datos->>'confirmado')::boolean,false) THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Confirma el borrado de tus datos de Suizamente'; END IF;
    UPDATE public.suizamente_votos SET jugador_id='anon:'||gen_random_uuid()::text,usuario_id=NULL WHERE jugador_id=p_jugador;
    IF uid IS NOT NULL THEN DELETE FROM public.app_notifications WHERE recipient_id=uid AND kind='suizamente'; END IF;
    DELETE FROM suizamente_social.propuestas WHERE jugador=p_jugador AND estado='pendiente';
    DELETE FROM suizamente_social.jugadores WHERE id=p_jugador;
    RETURN jsonb_build_object('borrado',true);
  ELSIF p_accion NOT IN('perfil','bootstrap') THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Función no encontrada';
  END IF;
  RETURN jsonb_build_object('perfil',suizamente_social.perfil(p_jugador));
EXCEPTION WHEN check_violation OR foreign_key_violation OR invalid_text_representation OR numeric_value_out_of_range OR not_null_violation THEN
  RAISE SQLSTATE 'PT400' USING MESSAGE='Revisa los datos enviados';
END $$;
REVOKE ALL ON FUNCTION public.suizamente_social_api(text,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.suizamente_social_api(text,text,jsonb,text) TO service_role;

COMMIT;
