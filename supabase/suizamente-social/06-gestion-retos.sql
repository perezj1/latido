BEGIN;
CREATE TABLE IF NOT EXISTS suizamente_social.duelos_ocultos (
  codigo text NOT NULL REFERENCES suizamente_social.duelos(codigo) ON DELETE CASCADE,
  jugador text NOT NULL REFERENCES suizamente_social.jugadores(id) ON DELETE CASCADE,
  creado_en timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(codigo,jugador)
);
ALTER TABLE suizamente_social.duelos_ocultos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON suizamente_social.duelos_ocultos FROM PUBLIC,anon,authenticated;
COMMIT;
