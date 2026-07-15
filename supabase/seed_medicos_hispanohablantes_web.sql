-- Profesionales sanitarios hispanohablantes con web verificada.
-- Requiere ejecutar antes: supabase/business_address_and_phone.sql.
-- Generado: 2026-07-15. Perfiles: 72 (74 entradas de origen, 2 consolidadas).
-- Portadas web verificadas: 57 perfiles (59 entradas de origen).
-- IMPORTANTE: photo_url enlaza imágenes públicas declaradas por las webs de origen.
-- Confirma derechos de reutilización y considera copiar las imágenes a tu propio
-- bucket de Supabase Storage para evitar hotlinking o enlaces que puedan caducar.
-- providers.phone conserva todos los teléfonos; providers.whatsapp solo se rellena
-- para prefijos móviles suizos compatibles (075-079).

BEGIN;

-- El perfil de origen solo ofrece un avatar genérico. Sin foto, la interfaz
-- muestra automáticamente el emoji de la categoría Salud (🩺).
UPDATE public.providers
SET photo_url = NULL
WHERE lower(trim(name)) = lower('Dra. Raquel Hueso')
  AND canton = 'GE'
  AND website = 'https://www.gmo.ch/medecins-et-praticiens/746-raquel-hueso-ibanez';

WITH source (
  name,
  city,
  canton,
  description,
  services,
  whatsapp,
  email,
  website,
  photo_url,
  languages
) AS (
  VALUES
    ('Dr. Xavier Tenorio', 'Ginebra', 'GE', 'Cirujano plástico hispanohablante en Ginebra (GE). Dirección profesional: Chem. Rieu 18, 1208 Genève. Web profesional verificada el 2026-07-15: https://www.aesthetics-ge.ch/about-us/dr-xavier-tenorio/', ARRAY['Cirujano plástico']::text[], '+41 22 732 22 23', NULL, 'https://www.aesthetics-ge.ch/about-us/dr-xavier-tenorio/', 'https://www.aesthetics-ge.ch/wp-content/uploads/2024/05/xavier-tenorio.jpg', ARRAY['Español']::text[]),
    ('Dra. Fabiana Jorge', 'Zurich', 'ZH', 'Dentista hispanohablante en Zurich (ZH). Dirección profesional: Dübendorfstrasse 24, 8051 Zürich. Web profesional verificada el 2026-07-15: https://zahnarztpraxis-jorge.ch/de/', ARRAY['Dentista']::text[], '+41 44 322 24 85', 'info@zahnarztpraxis-jorge.ch', 'https://zahnarztpraxis-jorge.ch/de/', 'https://zahnarztpraxis-jorge.ch/wp-content/uploads/2019/11/cropped-fabiana-1.jpg', ARRAY['Español']::text[]),
    ('Dr. Luis Cuesta', 'Zurich', 'ZH', 'Dentista hispanohablante en Zurich (ZH). Dirección profesional: Forchstrasse 34, 8008 Zürich. Web profesional verificada el 2026-07-15: https://smiletowin.com/', ARRAY['Dentista']::text[], '+41 44 422 21 31', NULL, 'https://smiletowin.com/', 'https://smiletowin.com/wp-content/uploads/2020/10/20141018-Luis_Cuesta_1-2.jpg', ARRAY['Español']::text[]),
    ('Dr. Adrian Cano', 'Opfikon', 'ZH', 'Dentista y odontopediatra hispanohablante en Opfikon (ZH). Dirección profesional: Blériot-Allee 2, 8152 Glattpark (Opfikon). Web profesional verificada el 2026-07-15: https://zuerizahni.ch/', ARRAY['Dentista', 'Odontopediatra']::text[], '+41 44 317 10 10', 'info@zuerizahni.ch', 'https://zuerizahni.ch/', 'https://zuerizahni.ch/wp-content/uploads/2022/06/Zueri_Zahni_March2022-128-By_Felix_Groteloh.jpg', ARRAY['Español']::text[]),
    ('Dr. Alejandro Roncero', 'Collombey', 'VS', 'Dentista hispanohablante en Collombey (VS). Dirección profesional: Z.A. Entre deux Fossaux 4, 1868 Collombey. Web profesional verificada el 2026-07-15: https://chablais-dentaire.ch/medecins/dr-alejandro-roncero/', ARRAY['Dentista']::text[], '+41 24 481 49 49', NULL, 'https://chablais-dentaire.ch/medecins/dr-alejandro-roncero/', 'https://chablais-dentaire.ch/wp-content/uploads/2025/02/Portrait_Alejandro-Roncero.jpg', ARRAY['Español']::text[]),
    ('Dr. Antonio Ballesteros', 'Conthey', 'VS', 'Dentista hispanohablante en Conthey (VS). Dirección profesional: Rte Cantonale 11, 1964 Conthey. Web profesional verificada el 2026-07-15: https://dentistes-valais.ch/medecins/antonio-ballesteros/', ARRAY['Dentista']::text[], '+41 27 345 27 27', NULL, 'https://dentistes-valais.ch/medecins/antonio-ballesteros/', 'https://dentistes-valais.ch/wp-content/uploads/2025/02/Portrait_Antonio-Ballesteros.jpg', ARRAY['Español']::text[]),
    ('Dr. Jose Aguilar', 'Zurich', 'ZH', 'Dermatólogo hispanohablante en Zurich (ZH). Dirección profesional: Bahnhoffstrasse 77, 8001 Zurich. Web profesional verificada el 2026-07-15: https://www.skinmed.ch/jose-aguilar/', ARRAY['Dermatólogo']::text[], '+41 44 500 77 57', 'skinmed-zuerich@hin.ch', 'https://www.skinmed.ch/jose-aguilar/', 'https://www.skinmed.ch/wp-content/uploads/Portrait_Dr_Jose_Aguilar_Web.jpg', ARRAY['Español']::text[]),
    ('Dr. Celine Folly', 'Muttenz', 'BL', 'Dermatólogo hispanohablante en Muttenz (BL). Dirección profesional: Baselstrasse 9, 4132 Muttenz. Web profesional verificada el 2026-07-15: https://kreyden.ch/', ARRAY['Dermatólogo']::text[], '+41 61 463 88 88', 'empfang@kreyden.ch', 'https://kreyden.ch/', 'https://kreyden.ch/wp3/wp-content/uploads/2024/03/DSCF6164-e1713946143650-650x397.jpg', ARRAY['Español']::text[]),
    ('Dra. Marina Portela', 'Ginebra', 'GE', 'Endocrinólogo hispanohablante en Ginebra (GE). Dirección profesional: Rue le-corbusier 18-20, 1208 Ginebra. Web profesional verificada el 2026-07-15: https://www.cabinet-corbusier.ch/', ARRAY['Endocrinólogo']::text[], '+41 22 704 30 70', 'info@cabinet-corbusier.ch', 'https://www.cabinet-corbusier.ch/', 'https://www.cabinet-corbusier.ch/wp-content/uploads/sites/3/2023/02/consultations-cabinet-corbusier-geneve.jpg', ARRAY['Español']::text[]),
    ('Clara Martínez', 'Ginebra', 'GE', 'Fisioterapeuta hispanohablante en Ginebra (GE). Dirección profesional: Rue des Marbriers 4, 1204 Genève. Web profesional verificada el 2026-07-15: https://www.officemed.ch/', ARRAY['Fisioterapeuta']::text[], '+41 22 311 73 22', 'cmgf@officemed.ch', 'https://www.officemed.ch/', 'https://www.officemed.ch/wp-content/uploads/2022/05/officemed-group-bandeau-accueil-scaled.jpg', ARRAY['Español']::text[]),
    ('Mónica Montero', 'Lausanne', 'VD', 'Fisioterapeuta hispanohablante en Lausanne (VD). Dirección profesional: Rue de Genève 72, 1004 Lausanne. Web profesional verificada el 2026-07-15: https://www.physiotherapiemm.ch/centre', ARRAY['Fisioterapeuta']::text[], '+41 76 687 03 24', NULL, 'https://www.physiotherapiemm.ch/centre', 'https://lh7-us.googleusercontent.com/sitesv-images-rt/ACHe0d2_86HnaElxnBQ191yIdMHFvkR-rGwa9R5LALC0rvd-yRd-oOxunSQSM6A0PAy62HBsSZLFo8Qg9jE7cFvxAVHdmeU5AbDEuCiW9aZFg_5JREKUPb58aAxRMKFmllriu-ZO6fWS_Zghcmoe-Kwl7j-Q2k1gjg_MkleBLZg4N5Oswei48pwST2k8=w16383', ARRAY['Español']::text[]),
    ('Catalina Müller', 'Zurich', 'ZH', 'Fisioterapeuta hispanohablante en Zurich (ZH). Dirección profesional: Wallisellenstrasse 333, 8050 Zúrich. Web profesional verificada el 2026-07-15: https://physioswiss.ch/fr/praxen/71471/physio-catalina-muller-gmbh/', ARRAY['Fisioterapeuta']::text[], '+41 76 402 33 03', 'c.mueller@fisio-hin.ch', 'https://physioswiss.ch/fr/praxen/71471/physio-catalina-muller-gmbh/', 'https://physioswiss.ch/wp-content/uploads/sites/1/office/physio-catalina-mueller-gmbh-71465-image.jpg', ARRAY['Español']::text[]),
    ('Sara Miñán (especialidad suelo pélvico)', 'Opfikon', 'ZH', 'Fisioterapeuta hispanohablante en Opfikon (ZH). Dirección profesional: See Spital, Asylstrasse 19, 8810 Horgen. Web profesional verificada el 2026-07-15: https://see-spital.ch/', ARRAY['Fisioterapeuta']::text[], '+41 044 728 13 75', 'therapien@see-spital.ch', 'https://see-spital.ch/', 'https://res.cloudinary.com/see-spital/images/v1744273819/see-spital-moodspot-1-desktop/see-spital-moodspot-1-desktop.jpg?_i=AA', ARRAY['Español']::text[]),
    ('Juliana Rem', 'Urdorf', 'ZH', 'Fisioterapeuta hispanohablante en Urdorf (ZH). Dirección profesional: Schulstrasse 33, 8902 Urdorf. Web profesional verificada el 2026-07-15: https://physiofit.ch/', ARRAY['Fisioterapeuta']::text[], '+41 44 734 13 13', 'info@physiofit.ch', 'https://physiofit.ch/', 'https://physiofit.ch/img/empfang_1.jpg', ARRAY['Español']::text[]),
    ('Dr. Michael Steuerwald', 'Liestal', 'BL', 'Gastroenterólogo hispanohablante en Liestal (BL). Dirección profesional: Munzachstrasse 1a, 4410 Liestal. Web profesional verificada el 2026-07-15: https://www.praxis-steuerwald.ch/', ARRAY['Gastroenterólogo']::text[], '+41619220606', 'info@praxis-steuerwald.ch', 'https://www.praxis-steuerwald.ch/', NULL, ARRAY['Español']::text[]),
    ('Dra. María Rosa Leivas', 'Reinach', 'BL', 'Ginecólogo hispanohablante en Reinach (BL). Dirección profesional: Schönmattstrasse 2, 4153 Reinach. Web profesional verificada el 2026-07-15: https://www.bethesda-spital.ch/de/ueber-uns/mitarbeitende/staff/portrait/spital/belegaerzte/maria-rosa-leivas.html', ARRAY['Ginecólogo']::text[], '+41 61 711 55 88', NULL, 'https://www.bethesda-spital.ch/de/ueber-uns/mitarbeitende/staff/portrait/spital/belegaerzte/maria-rosa-leivas.html', NULL, ARRAY['Español']::text[]),
    ('Dr. Jean-Claude Spira', 'Basel', 'BS', 'Ginecólogo hispanohablante en Basel (BS). Dirección profesional: Schifflände 3, 4051 Basel. Web profesional verificada el 2026-07-15: https://www.bethesda-spital.ch/fr/sur-nous/collaborateurs/staff/portrait/spital/belegaerzte/jean-claude-spira.html', ARRAY['Ginecólogo']::text[], '+41 61 261 44 00', 'kinderwunsch@hin.ch', 'https://www.bethesda-spital.ch/fr/sur-nous/collaborateurs/staff/portrait/spital/belegaerzte/jean-claude-spira.html', 'https://www.bethesda-spital.ch/.imaging/mte/bethesda-theme/small/dam/spital/staff/belegaerzte/dr_spira.jpg/jcr:content/dr_spira.jpg', ARRAY['Español']::text[]),
    ('Dra. Daniela Baur-Günter', 'Berna', 'BE', 'Ginecólogo hispanohablante en Berna (BE). Dirección profesional: Spitalgasse 18, 3011 Bern. Web profesional verificada el 2026-07-15: https://praxisbaur.ch/', ARRAY['Ginecólogo']::text[], '+41 31 311 80 22', 'daniela.guenter@gmx.ch', 'https://praxisbaur.ch/', 'https://praxisbaur.ch/wp-content/uploads/DanielaBauer_12.jpg', ARRAY['Español']::text[]),
    ('Dr. Alfred Brandenberger', 'Berna', 'BE', 'Ginecólogo hispanohablante en Berna (BE). Dirección profesional: Seilerstrasse 8, 3011 Bern. Web profesional verificada el 2026-07-15: https://www.drbrandenberger.ch/', ARRAY['Ginecólogo']::text[], '+41 31 381 22 88', NULL, 'https://www.drbrandenberger.ch/', 'https://le-de.cdn-website.com/f6cb88fe351e4f65b5dd4f2d6ea52d61/dms3rep/multi/opt/81-1920w.jpg', ARRAY['Español']::text[]),
    ('Dra. Nadin Imhof', 'Berna', 'BE', 'Ginecólogo hispanohablante en Berna (BE). Dirección profesional: Holligenstrasse 43/45, 3008 Bern. Web profesional verificada el 2026-07-15: https://www.praxisfrauenmedizin.ch/', ARRAY['Ginecólogo']::text[], '+41 31 904 00 10', 'info@praxisfrauenmedizin.ch', 'https://www.praxisfrauenmedizin.ch/', NULL, ARRAY['Español']::text[]),
    ('Dr. Jan Buss', 'Villars-sur-Glâne', 'FR', 'Ginecólogo hispanohablante en Villars-sur-Glâne (FR). Dirección profesional: Pérolles d''En Haut 2, 1752 Villars-sur-Glâne. Web profesional verificada el 2026-07-15: https://www.jbuss.ch/de', ARRAY['Ginecólogo']::text[], '+41 26 322 24 77', 'dr.buss@hin.ch', 'https://www.jbuss.ch/de', NULL, ARRAY['Español']::text[]),
    ('Dr. Gastón Enrique Grant', 'Fribourg', 'FR', 'Ginecólogo hispanohablante en Fribourg (FR). Dirección profesional: Rue Hans-Geiler 6, 1700 Fribourg. Web profesional verificada el 2026-07-15: https://point-f.ch/', ARRAY['Ginecólogo']::text[], '+41 26 309 21 88', 'secretariat@point-f.ch', 'https://point-f.ch/', 'https://point-f.ch/wp-content/uploads/2025/08/gynecologue-fribourg-femme.jpg', ARRAY['Español']::text[]),
    ('Dra. Christine Nicora', 'Ginebra', 'GE', 'Ginecólogo hispanohablante en Ginebra (GE). Dirección profesional: Cr de Rive 2, 1204 Genève. Web profesional verificada el 2026-07-15: https://cidge.ch/?page_id=1149', ARRAY['Ginecólogo']::text[], '+41 22 566 68 00', NULL, 'https://cidge.ch/?page_id=1149', 'http://cidge.ch/wp-content/uploads/2022/08/ch.ch-Copie-scaled.jpg', ARRAY['Español']::text[]),
    ('Dr. Patricio Andrade', 'Ginebra', 'GE', 'Ginecólogo hispanohablante en Ginebra (GE). Dirección profesional: Rte de Frontenex 60g, 1207 Genève. Web profesional verificada el 2026-07-15: https://www.la-tour.ch/en/physicians-and-practitioners/patricio-andrade', ARRAY['Ginecólogo']::text[], '+41 22 301 51 51', NULL, 'https://www.la-tour.ch/en/physicians-and-practitioners/patricio-andrade', 'https://www.la-tour.ch/sites/default/files/static_pages/e1.png', ARRAY['Español']::text[]),
    ('Dra. Stephanie Felder', 'Luzern', 'LU', 'Ginecólogo hispanohablante en Luzern (LU). Dirección profesional: Haldenstrasse 11, 6006 Luzern. Web profesional verificada el 2026-07-15: https://www.hirslanden.ch/de/corporate/aerzte/4/dr-med-stephanie-felder.html', ARRAY['Ginecólogo']::text[], '+41 41 419 03 03', NULL, 'https://www.hirslanden.ch/de/corporate/aerzte/4/dr-med-stephanie-felder.html', 'https://www.hirslanden.ch/content/dam/corporate/doctors/4204150-dr-med-stephanie-felder.jpg', ARRAY['Español']::text[]),
    ('Dra. Melanie Wendel', 'Sursee', 'LU', 'Ginecólogo hispanohablante en Sursee (LU). Dirección profesional: Luzerner Kantonsspital, Spitalstrasse 16a, 6210 Sursee. Web profesional verificada el 2026-07-15: https://www.luks.ch/', ARRAY['Ginecólogo']::text[], '+41 41 926 42 00', 'gyn.sursee@luks.ch', 'https://www.luks.ch/', 'https://www.luks.ch/sites/default/files/media/images/NAB171211-K-050.jpg', ARRAY['Español']::text[]),
    ('Dra. Martina Sánchez Revelo', 'Sursee', 'LU', 'Ginecólogo hispanohablante en Sursee (LU). Dirección profesional: Luzerner Kantonsspital, Spitalstrasse 16a, 6210 Sursee. Web profesional verificada el 2026-07-15: https://www.luks.ch/', ARRAY['Ginecólogo']::text[], '+41 41 926 42 00', 'gyn.sursee@luks.ch', 'https://www.luks.ch/', 'https://www.luks.ch/sites/default/files/media/images/NAB171211-K-050.jpg', ARRAY['Español']::text[]),
    ('Dr. Roger Eltbogen', 'Solothurn', 'SO', 'Ginecólogo hispanohablante en Solothurn (SO). Dirección profesional: Rossmarktplatz 12, 4500 Solothurn. Web profesional verificada el 2026-07-15: https://www.solothurnerspitaeler.ch/portfolio/roger-eltbogen/', ARRAY['Ginecólogo']::text[], '+41 32 621 77 11', 'eltbogen@hin.ch', 'https://www.solothurnerspitaeler.ch/portfolio/roger-eltbogen/', 'https://www.solothurnerspitaeler.ch/fileadmin/Personen/Portraet/Eltbogen_Roger_p1_web-2.jpg', ARRAY['Español']::text[]),
    ('Dra. Helene Huldi', 'Solothurn', 'SO', 'Ginecólogo hispanohablante en Solothurn (SO). Dirección profesional: Theatergasse 26, 4500 Solothurn. Web profesional verificada el 2026-07-15: https://www.solothurnerspitaeler.ch/portfolio/helene-huldi/', ARRAY['Ginecólogo']::text[], '+41 32 621 34 54', 'runa@hin.ch', 'https://www.solothurnerspitaeler.ch/portfolio/helene-huldi/', 'https://www.solothurnerspitaeler.ch/fileadmin/Personen/Portraet/Huldi_Helene_p1_web.jpg', ARRAY['Español']::text[]),
    ('Dra. Cecilia Figueroa Muruaga', 'Cheseaux-sur-Lausanne', 'VD', 'Ginecólogo hispanohablante en Cheseaux-sur-Lausanne (VD). Dirección profesional: Rue du Pâquis 6A, 1033 Cheseaux-sur-Lausanne. Web profesional verificada el 2026-07-15: https://www.officemed.ch/', ARRAY['Ginecólogo']::text[], '+41 21 804 59 59', 'cspg@officemed.ch', 'https://www.officemed.ch/', 'https://www.officemed.ch/wp-content/uploads/2022/05/officemed-group-bandeau-accueil-scaled.jpg', ARRAY['Español']::text[]),
    ('Dra. Rima Bazarbachi de Pury', 'Yverdon-les-Bains', 'VD', 'Ginecólogo hispanohablante en Yverdon-les-Bains (VD). Dirección profesional: Rue d''Entremonts 11, 1400 Yverdon-les-Bains. Web profesional verificada el 2026-07-15: https://www.ehnv.ch/', ARRAY['Ginecólogo']::text[], '+41 21 866 56 32', 'cabinet.bazarbachi@ehnv.ch', 'https://www.ehnv.ch/', 'https://www.ehnv.ch/sites/default/files/styles/ehnv_og_image/public/page-image/EHNV_Homepage%402x.png?itok=AYEynQg6', ARRAY['Español']::text[]),
    ('Dra. Anna Fischer', 'Zürich', 'ZH', 'Ginecólogo hispanohablante en Zürich (ZH). Dirección profesional: Höschgasse 50, 8008 Zürich. Web profesional verificada el 2026-07-15: https://gyn-health.ch/de', ARRAY['Ginecólogo']::text[], '+41 43 819 37 87', 'fischer@gyn-health.ch', 'https://gyn-health.ch/de', 'https://gyn-health.ch/storage/app/media/contenteditor/gynhhome.jpg', ARRAY['Español']::text[]),
    ('Dra. Patricia Pless', 'Zürich', 'ZH', 'Ginecólogo hispanohablante en Zürich (ZH). Dirección profesional: Frymannstrasse 21, 8041 Zürich. Web profesional verificada el 2026-07-15: https://www.praxislavida.ch/team', ARRAY['Ginecólogo']::text[], '+41 44 599 20 21', 'praxislavida@hin.ch', 'https://www.praxislavida.ch/team', NULL, ARRAY['Español']::text[]),
    ('Dr. Helge Köhler', 'Zürich', 'ZH', 'Ginecólogo hispanohablante en Zürich (ZH). Dirección profesional: Bleicherweg 68, 8002 Zürich. Web profesional verificada el 2026-07-15: https://www.citigyn.ch/en/', ARRAY['Ginecólogo']::text[], '+41 44 202 19 09', NULL, 'https://www.citigyn.ch/en/', 'https://www.citigyn.ch/wp-content/uploads/labor_team_w-ag-transparent-e1663849298287.png', ARRAY['Español']::text[]),
    ('Dra. Lissy Antunez', 'Zürich', 'ZH', 'Ginecólogo hispanohablante en Zürich (ZH). Dirección profesional: Albisriederstrasse 183, 8047 Zürich. Web profesional verificada el 2026-07-15: https://www.gyn-hubertus.ch/', ARRAY['Ginecólogo']::text[], '+41 44 552 44 35', 'info@gyn-hubertus.ch', 'https://www.gyn-hubertus.ch/', NULL, ARRAY['Español']::text[]),
    ('Dra. Michaela Schmid', 'Zürich', 'ZH', 'Ginecólogo hispanohablante en Zürich (ZH). Dirección profesional: Forchstrasse 289, 8008 Zürich. Web profesional verificada el 2026-07-15: https://michaelaschmid.ch/en/index_en.html', ARRAY['Ginecólogo']::text[], '+41 44 389 10 50', NULL, 'https://michaelaschmid.ch/en/index_en.html', 'https://michaelaschmid.ch/img/ms_01.jpg', ARRAY['Español']::text[]),
    ('Dr. Ralf Baumgartner', 'Zürich', 'ZH', 'Ginecólogo hispanohablante en Zürich (ZH). Dirección profesional: Freiestrasse 211, 8032 Zürich. Web profesional verificada el 2026-07-15: https://spitalzollikerberg.ch/en/team/ralf-horst-baumgartner', ARRAY['Ginecólogo']::text[], '+41 44 381 45 48', 'ralf.baumgartner@freesurf.ch', 'https://spitalzollikerberg.ch/en/team/ralf-horst-baumgartner', 'https://spitalzollikerberg.ch/_next/image?url=https%3A%2F%2Fgesundheitswelt-zollikerberg.ch%2Fdownload-file%2Fd539fb9b-07ce-4214-84cf-9cff2644d264%3Fv%3D2025-08-28T12%3A39%3A12.000Z&w=3840&q=75', ARRAY['Español']::text[]),
    ('Dr. Carlo Fonzini', 'Zürich', 'ZH', 'Ginecólogo hispanohablante en Zürich (ZH). Dirección profesional: Bahnhofstrasse 106, 8001 Zürich. Web profesional verificada el 2026-07-15: https://www.hirslanden.ch/en/corporate/doctors/3/dr-med-carlo-fonzini.html', ARRAY['Ginecólogo']::text[], '+41 44 211 92 72', NULL, 'https://www.hirslanden.ch/en/corporate/doctors/3/dr-med-carlo-fonzini.html', 'https://mediclinic.scene7.com/is/image/mediclinic/3735238-dr-med-carlo-fonzini?_ck=1656929535109', ARRAY['Español']::text[]),
    ('Dra. Eva Haller', 'Zürich', 'ZH', 'Ginecólogo hispanohablante en Zürich (ZH). Dirección profesional: Stockerstrasse 45, 8002 Zürich. Web profesional verificada el 2026-07-15: https://www.gynstockerstrasse.ch/e/eva-haller/', ARRAY['Ginecólogo']::text[], '+41 44 527 90 30', 'stockigyn@hin.ch', 'https://www.gynstockerstrasse.ch/e/eva-haller/', 'https://www.gynstockerstrasse.ch/wp-content/uploads/2023/12/20231120-Eva-portrait_Amelie-Clements_web-1024x683.jpg', ARRAY['Español']::text[]),
    ('Dra. Vera von Warburg', 'Zürich', 'ZH', 'Ginecólogo hispanohablante en Zürich (ZH). Dirección profesional: Goldbrunnenstrasse 87, 8055 Zürich. Web profesional verificada el 2026-07-15: https://go87.ch/', ARRAY['Ginecólogo']::text[], '+41 44 461 48 38', 'praxis@go87.ch', 'https://go87.ch/', NULL, ARRAY['Español']::text[]),
    ('Dra. Silke Anny Martine Michaelis', 'Zürich', 'ZH', 'Ginecólogo hispanohablante en Zürich (ZH). Dirección profesional: Universitätsspital Zürich, Frauenklinikstrasse 10, 8091 Zürich. Web profesional verificada el 2026-07-15: https://www.usz.ch/', ARRAY['Ginecólogo']::text[], '+41 44 255 11 11', 'silke.michaelis@usz.ch', 'https://www.usz.ch/', 'https://www.usz.ch/app/uploads/2026/02/Headerbild_USZ_Geburtshilfe.jpg', ARRAY['Español']::text[]),
    ('Dra. Yvette Planbeck-Rauber', 'Zurich', 'ZH', 'Ginecólogo hispanohablante en Zurich (ZH). Dirección profesional: Minervastrasse 99, 8032 Zurich. Web profesional verificada el 2026-07-15: https://zismed.ch/de/', ARRAY['Ginecólogo']::text[], '+41 44 233 30 30', 'info@zismed.ch', 'https://zismed.ch/de/', 'https://zismed.ch/wp-content/uploads/2026/03/zismed-logo-social-share-v1.png', ARRAY['Español']::text[]),
    ('Dra. Aurelia Maria Sonderer', 'Zürich', 'ZH', 'Ginecólogo hispanohablante en Zürich (ZH). Dirección profesional: Gottfried-Keller-Str. 7, 8001 Zürich. Web profesional verificada el 2026-07-15: https://www.swissmedical.net/de', ARRAY['Ginecólogo']::text[], '+41 58 715 22 22', 'ASonderer@swissmedical.net', 'https://www.swissmedical.net/de', 'https://www.swissmedical.net/site/assets/files/1/2023_06_22-4153-verbessert-rr_2600x900.jpg', ARRAY['Español']::text[]),
    ('Dr. Daniele Perucchini', 'Zürich', 'ZH', 'Ginecólogo hispanohablante en Zürich (ZH). Dirección profesional: Gottfried Keller-Strasse 7, 8001 Zürich. Web profesional verificada el 2026-07-15: https://www.hirslanden.ch/de/corporate/aerzte/4/pd-dr-med-daniele-perucchini.html', ARRAY['Ginecólogo']::text[], '+41 44 253 24 40', NULL, 'https://www.hirslanden.ch/de/corporate/aerzte/4/pd-dr-med-daniele-perucchini.html', 'https://mediclinic.scene7.com/is/image/mediclinic/442-pd-dr-med-daniele-perucchini?_ck=1636037705553', ARRAY['Español']::text[]),
    ('Dr. Dimitrios Zavitsanakis', 'Bülach', 'ZH', 'Ginecólogo hispanohablante en Bülach (ZH). Dirección profesional: Marktgasse 17, 8180 Bülach. Web profesional verificada el 2026-07-15: https://www.frauenarzt-buelach.ch/', ARRAY['Ginecólogo']::text[], '+41 44 860 94 64', 'dimitris.zavitsanakis@frauenarzt-buelach.ch', 'https://www.frauenarzt-buelach.ch/', 'https://www.frauenarzt-buelach.ch/_cmsbox_images_80_1200_627/pictures/09/c1b4gt9ac1ml1qknq8nqj2vx228uxx/empfang_arztpraxis.jpg', ARRAY['Español']::text[]),
    ('Bernadette Albrecht', 'Pratteln', 'BL', 'Matrona hispanohablante en Pratteln (BL). Dirección profesional: Liestalerstrasse 21, 4133 Pratteln. Web profesional verificada el 2026-07-15: https://www.tagmond.ch/', ARRAY['Matrona']::text[], '+41 61 311 96 34', 'bernadette.albrecht@tagmond.ch', 'https://www.tagmond.ch/', 'https://image.jimcdn.com/app/cms/image/transf/none/path/s33577ff199cd472b/image/id8fc9b259d245e61/version/1750761443/image.png', ARRAY['Español']::text[]),
    ('Eva-Maria Eigenmann-Leutwyler', 'Rapperswil-Jona', 'SG', 'Matrona hispanohablante en Rapperswil-Jona (SG). Dirección profesional: Obere Bahnhofstr. 46, 8640 Rapperswil-Jona. Web profesional verificada el 2026-07-15: https://hebammenpraxisrapperswil.ch/', ARRAY['Matrona']::text[], '+41 76 341 47 00', 'kontakt@hebammenpraxisrapperswil.ch', 'https://hebammenpraxisrapperswil.ch/', 'https://hebammenpraxisrapperswil.ch/img/asset/d2ViL3RlYW0vaGViLTcuanBn/heb-7.jpg?w=1024&h=576&fit=crop&q=80&s=a3f4ead28a81fdf7f133c924c73a136e', ARRAY['Español']::text[]),
    ('Serena Debrunner', 'Zurich', 'ZH', 'Matrona hispanohablante en Zurich (ZH). Dirección profesional: Nordstrasse 108, 8037 Zurich. Web profesional verificada el 2026-07-15: https://hebammenpraxis-zuerich.ch/', ARRAY['Matrona']::text[], '+41 76 565 17 23', 'debrunner@hebammenpraxis-zuerich.ch', 'https://hebammenpraxis-zuerich.ch/', NULL, ARRAY['Español']::text[]),
    ('Felizitas Bomba', 'Zurich', 'ZH', 'Matrona hispanohablante en Zurich (ZH). Dirección profesional: Nordstrasse 108, 8037 Zurich. Web profesional verificada el 2026-07-15: https://hebammenpraxis-zuerich.ch/', ARRAY['Matrona']::text[], '+41 78 927 64 81', 'hebammen@hebammenpraxis-zuerich.ch', 'https://hebammenpraxis-zuerich.ch/', NULL, ARRAY['Español']::text[]),
    ('Dra. Olaya Madrid Pascual', 'Zurich', 'ZH', 'Médico de cabecera hispanohablante en Zurich (ZH). Dirección profesional: Badenerstrasse 177, 8003 Zúrich. Web profesional verificada el 2026-07-15: https://www.arztpraxiskalkbreite.ch/', ARRAY['Médico de cabecera']::text[], '+41 44 350 39 39', 'kontakt@arztpraxiskalkbreite.ch', 'https://www.arztpraxiskalkbreite.ch/', 'https://www.arztpraxiskalkbreite.ch/wp-content/uploads/2021/10/cropped-AK_Logo_final_CMYK_web.jpg', ARRAY['Español']::text[]),
    ('Dra. Dona Reyna Ricapa', 'Illnau-Effretikon', 'ZH', 'Médico de cabecera hispanohablante en Illnau-Effretikon (ZH). Dirección profesional: Schlimpergstrasse 2, 8307 Illnau-Effretikon. Web profesional verificada el 2026-07-15: https://www.arztpraxis-ilef.ch/', ARRAY['Médico de cabecera']::text[], '+41 52 343 55 44', 'info@arztpraxis-ilef.ch', 'https://www.arztpraxis-ilef.ch/', 'https://le-de.cdn-website.com/06540b225413478688ffebc25942e2e5/dms3rep/multi/opt/Arztpraxis-Illnau-Effretikon-social-logo-1920w.jpg', ARRAY['Español']::text[]),
    ('Dra. Hoa Trieu', 'Sissach', 'BL', 'Médico de cabecera hispanohablante en Sissach (BL). Dirección profesional: Itingerstrasse 4, 4450 Sissach. Web profesional verificada el 2026-07-15: https://www.medical-sante.ch/rdv-Trieu-Hoa/Medecin/Sissach/9314', ARRAY['Médico de cabecera']::text[], '+41 61 971 33 91', NULL, 'https://www.medical-sante.ch/rdv-Trieu-Hoa/Medecin/Sissach/9314', NULL, ARRAY['Español']::text[]),
    ('Dra. Raquel Hueso', 'Ginebra', 'GE', 'Médico de cabecera hispanohablante en Ginebra (GE). Dirección profesional: Route de Loëx 3, 1213 Onex. Web profesional verificada el 2026-07-15: https://www.gmo.ch/medecins-et-praticiens/746-raquel-hueso-ibanez', ARRAY['Médico de cabecera']::text[], '+41 22 879 50 50', NULL, 'https://www.gmo.ch/medecins-et-praticiens/746-raquel-hueso-ibanez', NULL, ARRAY['Español']::text[]),
    ('Dr. Misha Pless', 'Lucerna', 'LU', 'Neurólogo y oftalmólogo hispanohablante en Lucerna (LU). Dirección profesional: Spitalstrasse, 6004 Luzern (Luzerner Kantonsspital). Web profesional verificada el 2026-07-15: https://www.luks.ch/', ARRAY['Neurólogo', 'Oftalmólogo']::text[], '+41 41 205 34 10', 'augenlaser@luks.ch', 'https://www.luks.ch/', 'https://www.luks.ch/sites/default/files/media/images/NAB171211-K-050.jpg', ARRAY['Español']::text[]),
    ('Dra. Sonja Laverièrre', 'Rotkreuz', 'ZG', 'Odontopediatra hispanohablante en Rotkreuz (ZG). Dirección profesional: Buonaserstrasse 7, 6343 Rotkreuz. Web profesional verificada el 2026-07-15: https://adent.ch/', ARRAY['Odontopediatra']::text[], '+41 41 566 76 10', 'rotkreuz@adent.ch', 'https://adent.ch/', 'https://adent.ch/wp-content/uploads/2024/04/adent-aubonne-mai-2022-igor-laski-web-hd-srvb-48.jpg', ARRAY['Español']::text[]),
    ('Ardentis Cliniques Dentaires', 'Varios', 'VD', 'Odontopediatra hispanohablante en Varios (VD). Dirección profesional: Varias clínicas por la zona francófona. Web profesional verificada el 2026-07-15: https://www.ardentis.ch/', ARRAY['Odontopediatra']::text[], NULL, 'info@ardentis.ch', 'https://www.ardentis.ch/', 'https://www.ardentis.ch/wp-content/uploads/2025/11/ardentis-photo-apprentissage-assistant-dentaires-formationr-1-4.3-2025.jpg', ARRAY['Español']::text[]),
    ('Dra. Yasmin Ruiz', 'Basel', 'BS', 'Oftalmólogo hispanohablante en Basel (BS). Dirección profesional: Missionstrasse 53, 4055 Basel. Web profesional verificada el 2026-07-15: https://vista.ch/', ARRAY['Oftalmólogo']::text[], '+41 61 691 67 91', 'ugenpraxis.missionsstrasse@vista.ch', 'https://vista.ch/', 'https://vista.ch/wp-content/uploads/2022/09/Augenlasern_Symbolbild.jpg', ARRAY['Español']::text[]),
    ('Dr. Dominik Rehm', 'Rheinfelden', 'AG', 'Pediatra hispanohablante en Rheinfelden (AG). Dirección profesional: Fassbindstrasse 2-4, 4310 Rheinfelden. Web profesional verificada el 2026-07-15: https://xn--kinderrzte-v5a.xn--rzte-am-werk-fcb.ch/praxis.php?DOC_INST=14', ARRAY['Pediatra']::text[], '+41 61 836 20 20', 'kinderaerzte-am-werk@hin.ch', 'https://xn--kinderrzte-v5a.xn--rzte-am-werk-fcb.ch/praxis.php?DOC_INST=14', 'https://xn--kinderrzte-v5a.xn--rzte-am-werk-fcb.ch/webyep-system/data/2-14-1-im-Bild_gross_-4483.jpg', ARRAY['Español']::text[]),
    ('Dra. Diana Berli', 'Rheinfelden', 'AG', 'Pediatra hispanohablante en Rheinfelden (AG). Dirección profesional: Fassbindstrasse 2-4, 4310 Rheinfelden. Web profesional verificada el 2026-07-15: https://xn--kinderrzte-v5a.xn--rzte-am-werk-fcb.ch/praxis.php?DOC_INST=51', ARRAY['Pediatra']::text[], '+41 61 836 20 20', 'kinderaerzte-am-werk@hin.ch', 'https://xn--kinderrzte-v5a.xn--rzte-am-werk-fcb.ch/praxis.php?DOC_INST=51', 'https://xn--kinderrzte-v5a.xn--rzte-am-werk-fcb.ch/webyep-system/data/2-51-1-im-Bild_gross_-3488.jpg', ARRAY['Español']::text[]),
    ('Dr. Roland Laager', 'Birsfelden', 'BL', 'Pediatra hispanohablante en Birsfelden (BL). Dirección profesional: Hardstrasse 6, 4127 Birsfelden. Web profesional verificada el 2026-07-15: https://www.bethesda-spital.ch/de/ueber-uns/mitarbeitende/staff/portrait/spital/paediater/roland-laager.html', ARRAY['Pediatra']::text[], '+41 61 312 00 74', NULL, 'https://www.bethesda-spital.ch/de/ueber-uns/mitarbeitende/staff/portrait/spital/paediater/roland-laager.html', 'https://www.bethesda-spital.ch/.imaging/mte/bethesda-theme/small/dam/spital/staff/paediater/roland_laager.jpg/jcr:content/roland_laager.jpg', ARRAY['Español']::text[]),
    ('Dra. Leticia Lopo', 'Uster', 'ZH', 'Pediatra hispanohablante en Uster (ZH). Dirección profesional: Loren-Allee 20, 8610 Uster. Web profesional verificada el 2026-07-15: https://www.flor-gesundheitszentrum.ch/', ARRAY['Pediatra']::text[], '+41 44 940 55 51', 'uster@flor-gesundheitszentrum.ch', 'https://www.flor-gesundheitszentrum.ch/', NULL, ARRAY['Español']::text[]),
    ('Dra. Nuria García Segarra', 'Meyrin', 'GE', 'Pediatra hispanohablante en Meyrin (GE). Dirección profesional: Rue de la Prulay 35, 1217 Meyrin. Web profesional verificada el 2026-07-15: https://www.officemed.ch/', ARRAY['Pediatra']::text[], '+41 22 782 54 31', 'cpm@officemed.ch', 'https://www.officemed.ch/', 'https://www.officemed.ch/wp-content/uploads/2022/05/officemed-group-bandeau-accueil-scaled.jpg', ARRAY['Español']::text[]),
    ('Dra. Nora Regelin', 'Brunnen', 'SZ', 'Pediatra hispanohablante en Brunnen (SZ). Dirección profesional: Bahnhofstrasse 22, 6440 Brunnen. Web profesional verificada el 2026-07-15: https://aerztehaus-brunnen.ch/', ARRAY['Pediatra']::text[], '+41 41 825 11 77', 'info@aerztehaus-brunnen.ch', 'https://aerztehaus-brunnen.ch/', 'https://aerztehaus-brunnen.ch/wp-content/uploads/2022/10/IMG_9666-scaled.jpg', ARRAY['Español']::text[]),
    ('Dra. Nadine Müller', 'Solothurn', 'SO', 'Pediatra hispanohablante en Solothurn (SO). Dirección profesional: Schöngrünstrasse 42, 4500 Solothurn. Web profesional verificada el 2026-07-15: https://gruprax.ch/', ARRAY['Pediatra']::text[], '+41 32 627 37 77', 'info@gruprax.ch', 'https://gruprax.ch/', 'https://gruprax.ch/images/aktuell/standort.png', ARRAY['Español']::text[]),
    ('Dra. Verena Jessenig', 'Witterswil', 'SO', 'Pediatra hispanohablante en Witterswil (SO). Dirección profesional: Oberdorf 12, 4108 Witterswil. Web profesional verificada el 2026-07-15: https://kiwipraxis.ch/', ARRAY['Pediatra']::text[], '+41 61 515 10 00', 'info@kiwipraxis.ch', 'https://kiwipraxis.ch/', 'https://kiwipraxis.ch/wp-content/uploads/2023/08/OA.png', ARRAY['Español']::text[]),
    ('Teresa Sánchez Haro', 'Bülach', 'ZH', 'Psicólogo hispanohablante en Bülach (ZH). Dirección profesional: Ziefelhütte 1, 8180 Bülach. Web profesional verificada el 2026-07-15: https://www.psychologie.ch/en/psyfinder/teresa-sanchez-haro', ARRAY['Psicólogo']::text[], '+41 78 223 77 91', 'terekalas@hotmail.com', 'https://www.psychologie.ch/en/psyfinder/teresa-sanchez-haro', 'https://www.psychologie.ch/storage/images/17916/conversions/CPBLMAZJOQD2nV4RxtmeyqVZqwZgFP-metaSU1HXzI1ODcuanBn--600x600.jpg', ARRAY['Español']::text[]),
    ('Gabriela Zamorano', 'Berna', 'BE', 'Psicólogo hispanohablante en Berna (BE). Dirección profesional: Consulta cerca del Zytglogge. Web profesional verificada el 2026-07-15: https://www.psychologie.ch/de', ARRAY['Psicólogo']::text[], '+41 76 283 54 49', 'gabriela.zamorano@psychologie.ch', 'https://www.psychologie.ch/de', 'https://www.psychologie.ch/storage/images/2493/conversions/psyfinder_1980x1320_sRGB-3x2.jpg', ARRAY['Español']::text[]),
    ('Muriel Heulin', 'Ginebra', 'GE', 'Psicólogo hispanohablante en Ginebra (GE). Dirección profesional: Boulevard de Saint-Georges 72, 1205 Genève. Web profesional verificada el 2026-07-15: https://www.centre-perinatal.ch/', ARRAY['Psicólogo']::text[], '+41 22 301 52 52', 'mh@centreperinatal.ch', 'https://www.centre-perinatal.ch/', NULL, ARRAY['Español']::text[]),
    ('Dra. Maria Victoria Lucero', 'Zurich', 'ZH', 'Psicólogo infantil hispanohablante en Zurich (ZH). Dirección profesional: Hallwylstrasse 29, 8004 Zürich. Web profesional verificada el 2026-07-15: https://pinocchio-zh.ch/', ARRAY['Psicólogo infantil']::text[], '+41 44 242 75 33', 'victoria.lucero@pinocchio-zh.ch', 'https://pinocchio-zh.ch/', 'https://pinocchio-zh.ch/wordpress/wp-content/uploads/2020/12/cropped-pinocchio-beratungsstelle-zurich-00031.jpg', ARRAY['Español']::text[]),
    ('Dra. Julia Jiménez-Meurer', 'Basel', 'BS', 'Psicólogo infantil hispanohablante en Basel (BS). Dirección profesional: Byfangweg 20, Parterre, 4051 Basel. Web profesional verificada el 2026-07-15: https://www.praxis-jimenez.ch/', ARRAY['Psicólogo infantil']::text[], '+41 79 849 27 07', 'jimenez@praxis-jimenez.ch', 'https://www.praxis-jimenez.ch/', NULL, ARRAY['Español']::text[]),
    ('Dr. Eduardo Puch', 'Ginebra', 'GE', 'Psiquiatra hispanohablante en Ginebra (GE). Dirección profesional: Rue Necker 17, 1201 Genève. Web profesional verificada el 2026-07-15: https://psychoanalyse.ch/profil/eduardo-puch', ARRAY['Psiquiatra']::text[], '+41 22 741 41 38', NULL, 'https://psychoanalyse.ch/profil/eduardo-puch', 'https://psychoanalyse.ch/typo3temp/assets/_processed_/b/c/csm_logo-psychoanalyse_2dca332117.png', ARRAY['Español']::text[]),
    ('Dr. Pascal Seite', 'Ginebra', 'GE', 'Traumatólogo hispanohablante en Ginebra (GE). Dirección profesional: Quai Wilson 35, 1201 Genève. Web profesional verificada el 2026-07-15: https://ortho-geneve.ch/portfolio-item/seite-pascal/', ARRAY['Traumatólogo']::text[], '+41 22 732 21 00', 'seite.pascal@bluewin.ch', 'https://ortho-geneve.ch/portfolio-item/seite-pascal/', NULL, ARRAY['Español']::text[])
), inserted AS (
  INSERT INTO public.providers (
    user_id,
    name,
    category,
    city,
    canton,
    address,
    description,
    services,
    price_range,
    phone,
    whatsapp,
    instagram,
    email,
    website,
    photo_url,
    languages,
    verified,
    featured,
    active
  )
  SELECT
    NULL::uuid,
    s.name,
    'salud',
    s.city,
    s.canton,
    NULLIF(trim(split_part(split_part(s.description, 'Dirección profesional: ', 2), '. Web profesional verificada', 1)), ''),
    trim(split_part(s.description, ' Web profesional verificada el ', 1)),
    s.services,
    NULL::text,
    s.whatsapp,
    CASE
      WHEN regexp_replace(coalesce(s.whatsapp, ''), '[^0-9]', '', 'g') ~ '^(0041|41|0)7[5-9][0-9]{7}$'
        THEN s.whatsapp
      ELSE NULL::text
    END,
    NULL::text,
    s.email,
    s.website,
    s.photo_url,
    s.languages,
    FALSE,
    FALSE,
    TRUE
  FROM source s
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.providers p
    WHERE lower(trim(p.name)) = lower(trim(s.name))
      AND p.canton = s.canton
      AND regexp_replace(coalesce(p.phone, p.whatsapp, ''), '[^0-9]', '', 'g') =
          regexp_replace(coalesce(s.whatsapp, ''), '[^0-9]', '', 'g')
  )
  RETURNING id
)
SELECT count(*) AS inserted_rows
FROM inserted;

COMMIT;

-- Comprobación posterior de este lote por sus webs verificadas.
WITH imported_websites (website) AS (
  VALUES
    ('https://www.aesthetics-ge.ch/about-us/dr-xavier-tenorio/'),
    ('https://zahnarztpraxis-jorge.ch/de/'),
    ('https://smiletowin.com/'),
    ('https://zuerizahni.ch/'),
    ('https://chablais-dentaire.ch/medecins/dr-alejandro-roncero/'),
    ('https://dentistes-valais.ch/medecins/antonio-ballesteros/'),
    ('https://www.skinmed.ch/jose-aguilar/'),
    ('https://kreyden.ch/'),
    ('https://www.cabinet-corbusier.ch/'),
    ('https://www.officemed.ch/'),
    ('https://www.physiotherapiemm.ch/centre'),
    ('https://physioswiss.ch/fr/praxen/71471/physio-catalina-muller-gmbh/'),
    ('https://see-spital.ch/'),
    ('https://physiofit.ch/'),
    ('https://www.praxis-steuerwald.ch/'),
    ('https://www.bethesda-spital.ch/de/ueber-uns/mitarbeitende/staff/portrait/spital/belegaerzte/maria-rosa-leivas.html'),
    ('https://www.bethesda-spital.ch/fr/sur-nous/collaborateurs/staff/portrait/spital/belegaerzte/jean-claude-spira.html'),
    ('https://praxisbaur.ch/'),
    ('https://www.drbrandenberger.ch/'),
    ('https://www.praxisfrauenmedizin.ch/'),
    ('https://www.jbuss.ch/de'),
    ('https://point-f.ch/'),
    ('https://cidge.ch/?page_id=1149'),
    ('https://www.la-tour.ch/en/physicians-and-practitioners/patricio-andrade'),
    ('https://www.hirslanden.ch/de/corporate/aerzte/4/dr-med-stephanie-felder.html'),
    ('https://www.luks.ch/'),
    ('https://www.luks.ch/'),
    ('https://www.solothurnerspitaeler.ch/portfolio/roger-eltbogen/'),
    ('https://www.solothurnerspitaeler.ch/portfolio/helene-huldi/'),
    ('https://www.officemed.ch/'),
    ('https://www.ehnv.ch/'),
    ('https://gyn-health.ch/de'),
    ('https://www.praxislavida.ch/team'),
    ('https://www.citigyn.ch/en/'),
    ('https://www.gyn-hubertus.ch/'),
    ('https://michaelaschmid.ch/en/index_en.html'),
    ('https://spitalzollikerberg.ch/en/team/ralf-horst-baumgartner'),
    ('https://www.hirslanden.ch/en/corporate/doctors/3/dr-med-carlo-fonzini.html'),
    ('https://www.gynstockerstrasse.ch/e/eva-haller/'),
    ('https://go87.ch/'),
    ('https://www.usz.ch/'),
    ('https://zismed.ch/de/'),
    ('https://www.swissmedical.net/de'),
    ('https://www.hirslanden.ch/de/corporate/aerzte/4/pd-dr-med-daniele-perucchini.html'),
    ('https://www.frauenarzt-buelach.ch/'),
    ('https://www.tagmond.ch/'),
    ('https://hebammenpraxisrapperswil.ch/'),
    ('https://hebammenpraxis-zuerich.ch/'),
    ('https://hebammenpraxis-zuerich.ch/'),
    ('https://www.arztpraxiskalkbreite.ch/'),
    ('https://www.arztpraxis-ilef.ch/'),
    ('https://www.medical-sante.ch/rdv-Trieu-Hoa/Medecin/Sissach/9314'),
    ('https://www.gmo.ch/medecins-et-praticiens/746-raquel-hueso-ibanez'),
    ('https://www.luks.ch/'),
    ('https://zuerizahni.ch/'),
    ('https://adent.ch/'),
    ('https://www.ardentis.ch/'),
    ('https://www.luks.ch/'),
    ('https://vista.ch/'),
    ('https://xn--kinderrzte-v5a.xn--rzte-am-werk-fcb.ch/praxis.php?DOC_INST=14'),
    ('https://xn--kinderrzte-v5a.xn--rzte-am-werk-fcb.ch/praxis.php?DOC_INST=51'),
    ('https://www.bethesda-spital.ch/de/ueber-uns/mitarbeitende/staff/portrait/spital/paediater/roland-laager.html'),
    ('https://www.flor-gesundheitszentrum.ch/'),
    ('https://www.officemed.ch/'),
    ('https://aerztehaus-brunnen.ch/'),
    ('https://gruprax.ch/'),
    ('https://kiwipraxis.ch/'),
    ('https://www.psychologie.ch/en/psyfinder/teresa-sanchez-haro'),
    ('https://www.psychologie.ch/de'),
    ('https://www.centre-perinatal.ch/'),
    ('https://pinocchio-zh.ch/'),
    ('https://www.praxis-jimenez.ch/'),
    ('https://psychoanalyse.ch/profil/eduardo-puch'),
    ('https://ortho-geneve.ch/portfolio-item/seite-pascal/')
)
SELECT p.canton, count(*) AS providers_with_verified_web
FROM public.providers p
JOIN (SELECT DISTINCT website FROM imported_websites) i
  ON lower(regexp_replace(p.website, '/+$', '')) =
     lower(regexp_replace(i.website, '/+$', ''))
WHERE p.category = 'salud'
GROUP BY p.canton
ORDER BY p.canton;
