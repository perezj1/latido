-- Reseñas públicas de Google para proveedores activos sin reseñas en Latido.
-- Auditoría: 2026-07-21. Este script escribe ÚNICAMENTE en public.reviews.
-- No modifica public.providers, public.provider_ratings ni la estructura de la base.
--
-- Coincidencias verificadas incluidas: 76 negocios.
-- Reseñas importadas: 342 (todos los comentarios encontrados, máximo 10 por negocio).
-- Cada texto es una traducción automática al castellano de un extracto literal de Google; […] indica que fue truncado.
-- No hay comentarios inventados. Estrellas, autor y fecha también corresponden a Google.
-- Si un negocio ya tenía reseñas ajenas a esta importación, se omite por completo.
-- Los UUID son deterministas: al repetir el script actualiza este lote sin crear duplicados.

BEGIN;

WITH imported_reviews (
  id, provider_id, expected_name, author_name, stars, review_text, published_at
) AS (
  VALUES
    -- 360 Virtus GmbH — Google: 4.9/5, 50 valoraciones.
    ('11a5fbcd-d0bb-5096-a6d7-7cb2653f8e2a'::uuid, '0e1e602e-dda4-4e78-aa67-5027cf43620b'::uuid, '360 Virtus GmbH', 'Lara Verbnjak · Google', 5, 'Mi novio y yo hemos sido clientes de 360 ​​Virtus […]', '2025-03-29'::date),
    ('4389364b-da5b-5b8a-a3f4-010de22e84af'::uuid, '0e1e602e-dda4-4e78-aa67-5027cf43620b'::uuid, '360 Virtus GmbH', 'Javier Urias · Google', 5, 'Muy profesionales y altamente cualificados. Cerca del cliente, exquisito. […]', '2024-04-29'::date),
    ('a4499f77-54ff-5b16-a0dd-abfd46fb9ed9'::uuid, '0e1e602e-dda4-4e78-aa67-5027cf43620b'::uuid, '360 Virtus GmbH', 'Sandra Simic · Google', 5, 'Tuve una consulta inicial realmente excelente sobre mis finanzas y mi declaración de impuestos. […]', '2024-11-30'::date),
    ('d31b4dcc-0982-59a7-ad3e-40e1cbc7de23'::uuid, '0e1e602e-dda4-4e78-aa67-5027cf43620b'::uuid, '360 Virtus GmbH', 'Jacky Spichale · Google', 5, 'Estoy súper contenta con los consejos de Tamara. Ella […]', '2025-05-28'::date),
    ('90d8fe18-a9c0-511a-a95c-068008a95df3'::uuid, '0e1e602e-dda4-4e78-aa67-5027cf43620b'::uuid, '360 Virtus GmbH', 'Mirabela Banica · Google', 5, '¡Soy cliente desde hace algunos años! Todo el personal es muy […]', '2025-05-13'::date),

    -- Adecco Luzern — Google: 3.6/5, 82 valoraciones.
    ('9b66b08b-4fe4-5f7b-a91c-f604e59dc92a'::uuid, 'ddbdb133-18f0-423c-b8fa-b18b2051bbcd'::uuid, 'Adecco Luzern', 'Bossman · Google', 5, 'Ivanka, la señora de la recepción, es increíble, muy […]', '2023-02-22'::date),
    ('c864bd7a-7d82-5583-af9b-1280203b2218'::uuid, 'ddbdb133-18f0-423c-b8fa-b18b2051bbcd'::uuid, 'Adecco Luzern', 'Safder Ali Mirza · Google', 5, 'Poco tiempo trabajando con el Sr. Martin Robin, muy agradable. […]', '2025-01-15'::date),

    -- Agencia de marketing | Schmon Media — Google: 5.0/5, 3 valoraciones.
    ('40549d6b-f493-5e47-a7f4-92c727c99681'::uuid, '7dc1fb08-ecca-4450-bb64-d74111fb5ce8'::uuid, 'Agencia de marketing | Schmon Media', 'mundo wave · Google', 5, 'Schmon Media creó toda la visibilidad online para Bünzli Baterías. […]', '2025-05-31'::date),

    -- Alemán con Ñ — Google: 5.0/5, 61 valoraciones.
    ('f5c380d8-4af9-5f31-ad85-314db55b1ddd'::uuid, 'c9f3696d-a9f4-4a49-8ebe-9ce34f339ec3'::uuid, 'Alemán con Ñ', 'Estefania Ibañez · Google', 5, 'Recomiendo mucho a Andrea y sus cursos. ella es una […]', '2025-03-18'::date),

    -- Auditrium — Google: 5.0/5, 1 valoraciones.
    ('387ff034-90bb-55fe-a878-3e5b48c8899b'::uuid, 'cbb7ee27-9f50-451c-9d3f-11de66d29ad4'::uuid, 'Auditrium', 'Silvan Kaeser · Google', 5, 'Me alegro de que Auditrium se ocupe competentemente de mi contabilidad. […]', '2022-06-08'::date),

    -- Autonomía Kooperative — Google: 3.8/5, 14 valoraciones.
    ('d9884948-a430-57d3-a4b7-f7887b834492'::uuid, 'ed90df50-9476-4129-b3f2-c03e8ef76ea6'::uuid, 'Autonomía Kooperative', 'Nana Jay · Google', 1, 'Dudoso, poco profesional, poco confiable. Eso es todo lo que puedo pensar sobre esta empresa. […]', '2025-06-03'::date),
    ('7bcfa499-6d39-5f03-ab26-3ad10f307128'::uuid, 'ed90df50-9476-4129-b3f2-c03e8ef76ea6'::uuid, 'Autonomía Kooperative', 'Bruno Dörig · Google', 5, 'Este equipo joven y muy motivado merecía una oportunidad en el […]', '2023-03-22'::date),
    ('10379127-a872-5bbd-a7de-414590de3c36'::uuid, 'ed90df50-9476-4129-b3f2-c03e8ef76ea6'::uuid, 'Autonomía Kooperative', 'Jan Alexander Heinzelmann · Google', 1, 'Versión corta: ya no confío en esta empresa y lo haría […]', '2023-03-02'::date),
    ('2e7789af-f641-501a-a13d-c6e3fc377b22'::uuid, 'ed90df50-9476-4129-b3f2-c03e8ef76ea6'::uuid, 'Autonomía Kooperative', 'Cheff OfAll · Google', 5, 'Estoy muy satisfecho con el trabajo. Las limpiadoras estan trabajando […]', '2024-01-03'::date),
    ('5447f737-83ef-5e8a-aab5-8303c7b72225'::uuid, 'ed90df50-9476-4129-b3f2-c03e8ef76ea6'::uuid, 'Autonomía Kooperative', 'Esposito Nicola · Google', 5, 'Elegí Autonomía porque me gustaba su filosofía. […]', '2023-03-21'::date),

    -- Benedict-Schule Luzern — Google: 4.4/5, 141 valoraciones.
    ('2e1b6c42-34c5-5939-ac76-079f0295f390'::uuid, '7d1f9d01-8d08-49be-9168-81d31e9f588d'::uuid, 'Benedict-Schule Luzern', 'Mr. MG · Google', 5, 'Me gustaría dejar comentarios positivos para esta escuela, […]', '2022-11-08'::date),
    ('32d43d56-e45d-541a-ab57-ffc5a9c3c565'::uuid, '7d1f9d01-8d08-49be-9168-81d31e9f588d'::uuid, 'Benedict-Schule Luzern', 'Yan Bai · Google', 5, 'Hola a todos. Estoy aprendiendo la lección intensiva de alemán B1 con […]', '2025-01-23'::date),
    ('b17f326a-0109-5ecc-ac78-2b8037b2f235'::uuid, '7d1f9d01-8d08-49be-9168-81d31e9f588d'::uuid, 'Benedict-Schule Luzern', 'Gio · Google', 1, 'Hay buenos profesores pero en general depende de […]', '2023-11-17'::date),
    ('f455a03d-5d1d-5b02-ac3d-73220dfb135d'::uuid, '7d1f9d01-8d08-49be-9168-81d31e9f588d'::uuid, 'Benedict-Schule Luzern', 'Sabir T · Google', 1, 'Desafortunadamente, tuve una mala experiencia con un profesor en […]', '2023-11-09'::date),
    ('b3d78b1f-78c1-52da-a3fc-f61aaf13bf5f'::uuid, '7d1f9d01-8d08-49be-9168-81d31e9f588d'::uuid, 'Benedict-Schule Luzern', 'Yura Privet · Google', 1, 'Mala experiencia...Me quejé varias veces de un profesor y del […]', '2023-11-17'::date),
    ('71bbf44d-0a19-5b2f-af8c-3f7c413c666d'::uuid, '7d1f9d01-8d08-49be-9168-81d31e9f588d'::uuid, 'Benedict-Schule Luzern', 'Zainab Alabdulla · Google', 1, 'Tampoco mereces una estrella. pero […]', '2020-08-21'::date),
    ('066abffd-35f3-5546-a66c-6c3da6bd6860'::uuid, '7d1f9d01-8d08-49be-9168-81d31e9f588d'::uuid, 'Benedict-Schule Luzern', 'Ego Fiktivum · Google', 5, 'Súper Nombre', '2022-10-25'::date),

    -- Berg Umzüge — Google: 5.0/5, 100 valoraciones.
    ('34f447b2-f046-5d09-a303-6c74aaafbae1'::uuid, 'fc1d8b66-279b-41e3-9d48-6d16d3d3c48e'::uuid, 'Berg Umzüge', 'Livy · Google', 5, '¡Gran experiencia! Hicieron todo lo posible por mí.', '2024-12-12'::date),

    -- Consulado General de España en Ginebra — Google: 3.9/5, 353 valoraciones.
    ('d3a35e75-3b2f-5bd9-ae65-67d164cb0ba4'::uuid, '3c14e455-4d87-4133-ba95-20376b097adf'::uuid, 'Consulado General de España en Ginebra', 'Michka · Google', 5, 'Funcionarios y más a ritmo español!!!', '2023-05-19'::date),
    ('68ff6461-de1c-50db-a9dc-63b74addb839'::uuid, '3c14e455-4d87-4133-ba95-20376b097adf'::uuid, 'Consulado General de España en Ginebra', 'Julien Denoyer · Google', 3, 'En general bien, brindan los servicios indicados en el sitio web. Ellos […]', '2022-03-28'::date),
    ('91a32444-1e53-563f-ac50-98b511430953'::uuid, '3c14e455-4d87-4133-ba95-20376b097adf'::uuid, 'Consulado General de España en Ginebra', 'Carlos GIL · Google', 5, 'He tratado con gente muy amable y profesional. I […]', '2021-09-17'::date),
    ('83c62a33-e001-56c5-a26f-ec6f122700a1'::uuid, '3c14e455-4d87-4133-ba95-20376b097adf'::uuid, 'Consulado General de España en Ginebra', 'Ebrima Kanteh · Google', 5, 'Son muy profesionales y trabajadores. realmente lo recomiendo […]', '2022-07-04'::date),
    ('74a5b462-f703-5e3a-ab91-3605f9214fc9'::uuid, '3c14e455-4d87-4133-ba95-20376b097adf'::uuid, 'Consulado General de España en Ginebra', 'Lorenzo · Google', 5, 'Servicio rápido y profesional, solo llegue temprano con todo […]', '2018-02-12'::date),
    ('e5512ce2-ebfe-5d98-aad9-0d5aba6585b9'::uuid, '3c14e455-4d87-4133-ba95-20376b097adf'::uuid, 'Consulado General de España en Ginebra', 'Angel Melchior · Google', 5, 'Excelente servicio', '2022-08-29'::date),

    -- Consulado General de España en Zúrich — Google: 3.6/5, 596 valoraciones.
    ('b94c0d2a-7dd3-5e7e-a38b-f9b492fc085c'::uuid, '03283706-1023-48b0-aeb9-6dd7ae7dbd4e'::uuid, 'Consulado General de España en Zúrich', 'etc · Google', 1, 'Si la apatía y la burocracia tuvieran un hijo, sería […]', '2025-05-30'::date),
    ('08e504aa-9ef4-5622-a3e5-c0de4b58a289'::uuid, '03283706-1023-48b0-aeb9-6dd7ae7dbd4e'::uuid, 'Consulado General de España en Zúrich', 'Oren · Google', 5, 'Personal extremadamente amable, servicial y eficiente. Todos se han ofrecido a […]', '2023-11-13'::date),
    ('7308f1b8-c271-52af-a8a5-8128751df20d'::uuid, '03283706-1023-48b0-aeb9-6dd7ae7dbd4e'::uuid, 'Consulado General de España en Zúrich', 'Luis Alberto Aguerre Enríquez · Google', 5, 'Excelente equipo. Me ayudaron diligentemente con mi consulta urgente. […]', '2023-05-05'::date),
    ('5c221422-374e-5aea-ad9a-b1ffcce58fb1'::uuid, '03283706-1023-48b0-aeb9-6dd7ae7dbd4e'::uuid, 'Consulado General de España en Zúrich', 'Javi Castegnaro · Google', 5, 'Después de vivir en Inglaterra y tener que experimentar con el […]', '2022-05-25'::date),
    ('455c0a3e-eb99-5e0a-a24c-e7c2eada4496'::uuid, '03283706-1023-48b0-aeb9-6dd7ae7dbd4e'::uuid, 'Consulado General de España en Zúrich', 'Adrian Grana · Google', 1, 'En realidad, no quería calificar a este consulado con tanta dureza. […]', '2024-06-12'::date),
    ('1dd2053d-2ce7-5b23-a6ae-97611441def9'::uuid, '03283706-1023-48b0-aeb9-6dd7ae7dbd4e'::uuid, 'Consulado General de España en Zúrich', 'Valeria Nicolini · Google', 5, 'He estado usando los servicios del consulado por más de […]', '2024-12-05'::date),

    -- Dr. Alfred Brandenberger — Google: 4.6/5, 8 valoraciones.
    ('248db8b5-d66d-59a1-a2e1-c8d2e699e8e6'::uuid, '24cca515-49ce-47dc-bd2d-9d2c38298619'::uuid, 'Dr. Alfred Brandenberger', 'Luna · Google', 5, 'El doctor hizo realidad mi sueño de ser madre […]', '2024-10-02'::date),
    ('707f144f-0a7c-52ea-a20c-f42578535d90'::uuid, '24cca515-49ce-47dc-bd2d-9d2c38298619'::uuid, 'Dr. Alfred Brandenberger', 'Rebby Aeschbacher · Google', 5, 'Empleado muy amable y sensible. El Sr. Dr. Brandenberger es muy […]', '2023-07-05'::date),
    ('45f01984-b9fd-5668-a3e6-f6d48e2fe58d'::uuid, '24cca515-49ce-47dc-bd2d-9d2c38298619'::uuid, 'Dr. Alfred Brandenberger', 'F Zu · Google', 5, 'Siempre tratado bien y rápido. Amable y sencillo sin ningún proxeneta.', '2023-05-08'::date),

    -- Dr. Carlo Fonzini — Google: 4.8/5, 36 valoraciones.
    ('3759bae0-2077-57f6-a018-910053720370'::uuid, 'c93483b4-860d-47c9-a3cf-72c33663e816'::uuid, 'Dr. Carlo Fonzini', 'C Tse · Google', 5, 'Conocimos al Dr. Fonzini durante una situación desafortunada con mi […]', '2025-02-11'::date),
    ('598769a1-a2af-5ac1-a0c2-806517d5dafa'::uuid, 'c93483b4-860d-47c9-a3cf-72c33663e816'::uuid, 'Dr. Carlo Fonzini', 'All Texts Editing · Google', 5, 'Me impresionó mucho el Dr. Fonzini y también […]', '2022-12-16'::date),
    ('dc248c9f-648c-5bb9-a840-d2bab6b0e393'::uuid, 'c93483b4-860d-47c9-a3cf-72c33663e816'::uuid, 'Dr. Carlo Fonzini', 'Polina Suchanek · Google', 5, 'El Dr. Fonzini es un gran médico, conocedor, muy experimentado, competente, […]', '2020-08-29'::date),
    ('8a5c0118-f682-574f-a753-19681920228f'::uuid, 'c93483b4-860d-47c9-a3cf-72c33663e816'::uuid, 'Dr. Carlo Fonzini', 'Aina Renolen Girault · Google', 5, 'Paciente, atento, digno de confianza y muy competente: toma su […]', '2021-03-03'::date),
    ('c0b9d603-57c5-58f2-a5c2-5e108d885298'::uuid, 'c93483b4-860d-47c9-a3cf-72c33663e816'::uuid, 'Dr. Carlo Fonzini', 'Ani M · Google', 5, 'El Dr. Fonzini es altamente competente y profesional, además empatiza […]', '2022-09-26'::date),
    ('910aad94-8212-5ddf-ad49-c2dd0743f2f5'::uuid, 'c93483b4-860d-47c9-a3cf-72c33663e816'::uuid, 'Dr. Carlo Fonzini', 'Alisa Berezutska · Google', 5, 'En 2 días mi hija cumple 3 meses y […]', '2022-06-22'::date),
    ('f546c307-ab42-5ea6-a829-004b6485243f'::uuid, 'c93483b4-860d-47c9-a3cf-72c33663e816'::uuid, 'Dr. Carlo Fonzini', 'Sanije S · Google', 5, 'El Dr. Fonzini es un médico excelente. Él te hace sentir […]', '2020-08-24'::date),

    -- Dr. Daniele Perucchini — Google: 4.4/5, 14 valoraciones.
    ('f1b8b782-6351-5946-afa3-188a1f2763a3'::uuid, '115acb31-f4fe-4163-9c63-44a026891f82'::uuid, 'Dr. Daniele Perucchini', 'C Bottion · Google', 5, 'Recomiendo ampliamente al Dr. Perucchini para cualquier persona con incontinencia urinaria. […]', '2022-05-31'::date),
    ('b1945dc5-a144-586a-ae0e-4c9d8a45e015'::uuid, '115acb31-f4fe-4163-9c63-44a026891f82'::uuid, 'Dr. Daniele Perucchini', 'Галина Мережко · Google', 5, 'Durante varios años tuve miedo de someterme a un examen. […]', '2024-08-21'::date),
    ('f69229d3-aa23-5d2d-a159-c7de7438939e'::uuid, '115acb31-f4fe-4163-9c63-44a026891f82'::uuid, 'Dr. Daniele Perucchini', 'Thefalcon Sah · Google', 5, 'Estoy muy satisfecho con el examen. se convirtió en mí […]', '2022-10-07'::date),
    ('73cbb231-c314-58a5-a4fd-afe22df4ca87'::uuid, '115acb31-f4fe-4163-9c63-44a026891f82'::uuid, 'Dr. Daniele Perucchini', 'SKae · Google', 5, 'Muy humano, amable, sumamente profesional, divertido, siempre de buen humor, toma […]', '2017-09-04'::date),

    -- Dr. Helge Köhler — Google: 4.8/5, 45 valoraciones.
    ('d311922a-e8ff-5704-a843-28becf3ce800'::uuid, 'aa4a4506-d0c6-40b8-b62f-3a9c1bd2f124'::uuid, 'Dr. Helge Köhler', 'Liz N · Google', 5, 'Soy paciente del Dr. Köhler desde hace muchos años y […]', '2025-06-16'::date),
    ('8d67579c-4647-5bf2-a257-47feca8a5357'::uuid, 'aa4a4506-d0c6-40b8-b62f-3a9c1bd2f124'::uuid, 'Dr. Helge Köhler', 'W L · Google', 5, 'El Dr. Köhler y su equipo (la recepcionista) son simplemente […]', '2024-02-17'::date),
    ('01344697-be67-5630-ae77-67bfa8f08e13'::uuid, 'aa4a4506-d0c6-40b8-b62f-3a9c1bd2f124'::uuid, 'Dr. Helge Köhler', 'W · Google', 5, 'Quedé muy satisfecho con la atención que recibí de […]', '2023-04-21'::date),
    ('77dfedec-3d72-503d-aa14-6bc2e6838348'::uuid, 'aa4a4506-d0c6-40b8-b62f-3a9c1bd2f124'::uuid, 'Dr. Helge Köhler', 'Zuleimy Torres · Google', 5, 'Estoy muy contento con el Dr. Köhler y su equipo. Él […]', '2019-04-16'::date),
    ('e78efafb-8fe3-5285-aea5-37635fea1b38'::uuid, 'aa4a4506-d0c6-40b8-b62f-3a9c1bd2f124'::uuid, 'Dr. Helge Köhler', 'Alexis Torres · Google', 5, '¡El Dr. Köhler y el personal son increíbles! tuve muchos […]', '2019-10-15'::date),
    ('57a00f28-53a8-5648-a30c-81437ac3c336'::uuid, 'aa4a4506-d0c6-40b8-b62f-3a9c1bd2f124'::uuid, 'Dr. Helge Köhler', 'Ada Garcia · Google', 1, 'La peor experiencia con un médico en Suiza. yo visito […]', '2024-07-12'::date),
    ('081813bc-b1d6-5378-a8f1-3532aaf5215c'::uuid, 'aa4a4506-d0c6-40b8-b62f-3a9c1bd2f124'::uuid, 'Dr. Helge Köhler', 'Lydia Mastori · Google', 5, 'El Dr. Kohler y su equipo son muy atentos, compasivos y […]', '2022-05-25'::date),

    -- Dr. Jan Buss — Google: 4.1/5, 19 valoraciones.
    ('d43d348a-823f-5169-a608-b75958b9482e'::uuid, 'e83b8940-c171-4837-9d02-44c269a20c41'::uuid, 'Dr. Jan Buss', 'Ivana Stojkovic · Google', 5, '¡Una práctica excepcional! Estoy absolutamente emocionado con mi primero. […]', '2024-10-25'::date),
    ('ff2f0553-13d0-52a1-a282-de9405536401'::uuid, 'e83b8940-c171-4837-9d02-44c269a20c41'::uuid, 'Dr. Jan Buss', 'Aleksandra Jeka · Google', 1, 'Mi primera cita fue fijada para una hora específica. […]', '2021-10-13'::date),
    ('8bbd8ac8-74ae-5909-a60f-b32bf4cce1c5'::uuid, 'e83b8940-c171-4837-9d02-44c269a20c41'::uuid, 'Dr. Jan Buss', 'Carolina Furrer · Google', 5, 'El Dr. Buss siempre dedica tiempo a mí y […]', '2022-04-06'::date),
    ('75c7dfd7-7280-5fe2-ae4e-25e3b6f9924f'::uuid, 'e83b8940-c171-4837-9d02-44c269a20c41'::uuid, 'Dr. Jan Buss', 'Monica Sanchez · Google', 5, 'Para mi el mejor médico que encontré en Suiza ,fue […]', '2024-09-03'::date),
    ('c1986f64-535c-5e1a-a36c-0cbd281cf53a'::uuid, 'e83b8940-c171-4837-9d02-44c269a20c41'::uuid, 'Dr. Jan Buss', 'Jacqueline Piccand · Google', 5, 'Muy buen medico. ¡Lo recomiendo mucho!', '2025-04-11'::date),
    ('98b5b212-174d-54d4-aea9-11e971707244'::uuid, 'e83b8940-c171-4837-9d02-44c269a20c41'::uuid, 'Dr. Jan Buss', 'Anna Kot · Google', 5, 'Excelente servicio aunque un poco de espera.', '2022-01-26'::date),
    ('57025cf9-d8cb-55c5-a6b3-a8b225152695'::uuid, 'e83b8940-c171-4837-9d02-44c269a20c41'::uuid, 'Dr. Jan Buss', 'Marina B · Google', 5, 'Estoy muy satisfecho con la profesionalidad del Dr. Jan Buss.', '2022-11-12'::date),
    ('88e5c431-934a-519d-a4d9-c23b10e6e3cd'::uuid, 'e83b8940-c171-4837-9d02-44c269a20c41'::uuid, 'Dr. Jan Buss', 'Zioudi Chaima · Google', 5, 'Es lo mejor recomendar muchas gracias.', '2023-09-02'::date),

    -- Dr. Jean-Claude Spira — Google: 4.0/5, 29 valoraciones.
    ('c1b86a2f-ca8a-5bab-a14a-8f09d19fc00e'::uuid, '96f51484-8495-4177-96ab-db90eaf5a28b'::uuid, 'Dr. Jean-Claude Spira', 'Varvara Troitskaya · Google', 1, 'Al Dr.Spira le faltan 2 cualidades muy importantes para el médico: […]', '2023-01-25'::date),
    ('63deadb4-7011-5141-af4c-8e792d2c4522'::uuid, '96f51484-8495-4177-96ab-db90eaf5a28b'::uuid, 'Dr. Jean-Claude Spira', 'jennifer nagle · Google', 1, 'Al Dr. Spira nunca se le debería haber permitido ejercer la medicina. […]', '2018-04-24'::date),
    ('3a484662-0664-5c44-a65d-7ed7b9b2734f'::uuid, '96f51484-8495-4177-96ab-db90eaf5a28b'::uuid, 'Dr. Jean-Claude Spira', 'Simone · Google', 3, 'Nuestro tratamiento de fertilidad duró de 2019 a 2023. […]', '2023-07-30'::date),
    ('cca0a6fc-1cf3-5f25-af96-6ef0fea7ae33'::uuid, '96f51484-8495-4177-96ab-db90eaf5a28b'::uuid, 'Dr. Jean-Claude Spira', 'Nina Rotundo · Google', 1, 'Tener que esperar mucho tiempo para una consulta inicial. El señor Spira tomó asiento. […]', '2022-10-04'::date),
    ('da810758-946a-5f5b-ae12-c5d954b85f50'::uuid, '96f51484-8495-4177-96ab-db90eaf5a28b'::uuid, 'Dr. Jean-Claude Spira', 'Anke Dittes · Google', 5, 'Intentamos tener un bebé durante casi dos años y medio. […]', '2022-08-15'::date),
    ('271e4b9e-c2bf-5feb-a6d3-dccbc646eb69'::uuid, '96f51484-8495-4177-96ab-db90eaf5a28b'::uuid, 'Dr. Jean-Claude Spira', 'Yukun Zong · Google', 1, 'El Dr. Spira tiene el informe de mi examen básico, que fue realizado por el […]', '2023-08-02'::date),
    ('89c25ab4-5e64-5aee-a515-08f254ba6c31'::uuid, '96f51484-8495-4177-96ab-db90eaf5a28b'::uuid, 'Dr. Jean-Claude Spira', 'Flavia Pircher · Google', 5, 'La señora Engesser-Mussbah me acompañó en dos embarazos. Mujer […]', '2024-05-28'::date),
    ('6ffc556f-a484-5071-a692-02c7791a2588'::uuid, '96f51484-8495-4177-96ab-db90eaf5a28b'::uuid, 'Dr. Jean-Claude Spira', 'Elodie Brantwein · Google', 5, 'He estado viendo al Dr. durante unos seis meses. Espira en […]', '2018-03-22'::date),

    -- Dr. Luis Cuesta — Google: 4.7/5, 42 valoraciones.
    ('0cc2c2e5-27af-5438-a020-2597660a9fac'::uuid, '44be59a5-28b4-42a8-be8c-3440e779d1a2'::uuid, 'Dr. Luis Cuesta', 'M L · Google', 5, 'Luis es realmente un muy buen dentista y también un […]', '2023-06-20'::date),
    ('f8e46481-bfa1-57c0-aef3-1cd9a42eb4f6'::uuid, '44be59a5-28b4-42a8-be8c-3440e779d1a2'::uuid, 'Dr. Luis Cuesta', 'Fran Jiménez · Google', 5, 'Luis ha sido mi dentista durante los últimos 8 años, […]', '2023-06-07'::date),
    ('0a94686c-6b9a-507d-a17e-9a5c6493c520'::uuid, '44be59a5-28b4-42a8-be8c-3440e779d1a2'::uuid, 'Dr. Luis Cuesta', 'Jason Gastaldo · Google', 5, 'Luis personalmente respondió detalladamente a mi correo electrónico sobre libre de BPA. […]', '2024-11-27'::date),
    ('8ad2e49d-d610-561b-a19e-58c70442b198'::uuid, '44be59a5-28b4-42a8-be8c-3440e779d1a2'::uuid, 'Dr. Luis Cuesta', 'Guillermo Martin-Ortiz · Google', 3, 'Fui a la práctica de Luis Cuesta a principios de esta semana para […]', '2023-12-06'::date),
    ('c569578a-765a-50cd-a367-dc761b29c875'::uuid, '44be59a5-28b4-42a8-be8c-3440e779d1a2'::uuid, 'Dr. Luis Cuesta', 'Gerhard Schobel · Google', 5, 'Un dentista que atiende con un enfoque holístico que conocí […]', '2020-12-06'::date),
    ('409f6057-0e2a-5907-af64-d710917176d3'::uuid, '44be59a5-28b4-42a8-be8c-3440e779d1a2'::uuid, 'Dr. Luis Cuesta', 'Armin H. Müller The White Glove Sommelier · Google', 5, 'Luis es una gran persona con excelentes habilidades para crear. […]', '2017-12-13'::date),

    -- Dr. Michael Steuerwald — Google: 4.5/5, 41 valoraciones.
    ('2c92ed48-38f8-53c5-af0b-a03aa5d5abda'::uuid, 'e5223850-b540-46be-8df3-b4bb3bb3d393'::uuid, 'Dr. Michael Steuerwald', 'Anne Treccarichi · Google', 5, '¡El mejor doctor de todos los tiempos!', '2024-12-20'::date),
    ('60c492bd-0171-5f7a-a06c-dd9e4367f732'::uuid, 'e5223850-b540-46be-8df3-b4bb3bb3d393'::uuid, 'Dr. Michael Steuerwald', 'Viviane Stillittano · Google', 5, 'La semana pasada fue mi primera visita al Dr. Tax Forest. Antes […]', '2023-01-16'::date),

    -- Dr. Pascal Seite — Google: 4.9/5, 228 valoraciones.
    ('4d05af9b-1d75-5dd6-a974-486225b9de2e'::uuid, 'a7469cee-2a2b-41a1-8861-4763082c5f6a'::uuid, 'Dr. Pascal Seite', 'Dmitri Boulakovski · Google', 5, 'Me gustaría agradecer al Dr. Seite por operar mi […]', '2024-06-19'::date),
    ('ef3a6794-e5d1-5540-af5c-bd7717543c41'::uuid, 'a7469cee-2a2b-41a1-8861-4763082c5f6a'::uuid, 'Dr. Pascal Seite', 'Luisa Fernanda ALVAREZ ZULUAGA · Google', 5, 'Tuve un accidente de esquí en enero de 2023. Después de ver […]', '2023-06-12'::date),
    ('8383425c-280d-5381-ad45-a38a79b653b3'::uuid, 'a7469cee-2a2b-41a1-8861-4763082c5f6a'::uuid, 'Dr. Pascal Seite', 'Nils Lewis · Google', 5, 'Fui al Dr. Seite después de una dislocación en un […]', '2020-09-23'::date),
    ('1e8ef9ce-8743-56ed-a424-d4223a084612'::uuid, 'a7469cee-2a2b-41a1-8861-4763082c5f6a'::uuid, 'Dr. Pascal Seite', 'Jennifer T · Google', 5, 'El Dr. Seite es un excelente médico y cirujano, muy atento. […]', '2022-10-21'::date),
    ('89b3568a-1995-5762-a514-48eb362fd460'::uuid, 'a7469cee-2a2b-41a1-8861-4763082c5f6a'::uuid, 'Dr. Pascal Seite', 'XJ J · Google', 5, 'Encontré al Dr. Seite después de buscar en Internet y […]', '2022-11-02'::date),
    ('6460ca69-27f3-58fc-aa5c-613e425386be'::uuid, 'a7469cee-2a2b-41a1-8861-4763082c5f6a'::uuid, 'Dr. Pascal Seite', 'John Lewis Peer · Google', 5, 'Gran Doctor, realmente espectacular, con extraordinaria atención, competencia y disponibilidad, […]', '2019-03-22'::date),
    ('7ed3068c-29fa-5c56-ac4b-adbcf5b57216'::uuid, 'a7469cee-2a2b-41a1-8861-4763082c5f6a'::uuid, 'Dr. Pascal Seite', 'Nicolas Carrocci · Google', 5, 'Muchas GRACIAS al Dr. Seite por brindarme […]', '2023-05-07'::date),
    ('a52c1e39-3be6-5d34-a278-b17f9b4f99e7'::uuid, 'a7469cee-2a2b-41a1-8861-4763082c5f6a'::uuid, 'Dr. Pascal Seite', 'John Oak · Google', 5, 'El Dr. Seite es un excelente cirujano ortopédico. El entiende como […]', '2023-05-09'::date),

    -- Dr. Patricio Andrade — Google: 4.4/5, 29 valoraciones.
    ('34aada43-5c23-5d85-ae3c-c2a8c70d23b9'::uuid, '1aadd8bf-db95-4d10-8a6e-983e8e62141d'::uuid, 'Dr. Patricio Andrade', 'Nan · Google', 1, 'Después de un par de años de estar con él, tuve una […]', '2024-12-16'::date),
    ('3b1c3ed6-95e3-569d-a0f8-a3c3323e9071'::uuid, '1aadd8bf-db95-4d10-8a6e-983e8e62141d'::uuid, 'Dr. Patricio Andrade', 'Charlotte Epelbaum · Google', 5, 'El mejor ginecólogo que he tenido. el se toma el tiempo […]', '2023-07-16'::date),
    ('1805e29a-8105-56f1-aba5-19931faba837'::uuid, '1aadd8bf-db95-4d10-8a6e-983e8e62141d'::uuid, 'Dr. Patricio Andrade', 'Alona Mihajlovic · Google', 5, 'Es un ginecoobstetra muy muy muy bueno, es un […]', '2019-06-25'::date),
    ('588037b5-6c6e-5848-a584-cd9efa89c990'::uuid, '1aadd8bf-db95-4d10-8a6e-983e8e62141d'::uuid, 'Dr. Patricio Andrade', 'alicia gonzalez · Google', 5, 'Excelente medico en todos los niveles.', '2022-04-23'::date),
    ('5313efa3-9508-5fed-a13a-a05aed479055'::uuid, '1aadd8bf-db95-4d10-8a6e-983e8e62141d'::uuid, 'Dr. Patricio Andrade', 'евгения евгения · Google', 5, 'El mejor especialista 👍🏻', '2022-11-13'::date),
    ('ab514d5a-a5c0-526b-a835-ca1eff231f76'::uuid, '1aadd8bf-db95-4d10-8a6e-983e8e62141d'::uuid, 'Dr. Patricio Andrade', 'Cécile Leroy · Google', 5, 'Me gustaría agradecer sinceramente al Dr. Andrade y su equipo. […]', '2025-04-03'::date),
    ('e59d1b00-0b38-5428-af57-98e60efdd5fa'::uuid, '1aadd8bf-db95-4d10-8a6e-983e8e62141d'::uuid, 'Dr. Patricio Andrade', 'Zhandumaya · Google', 5, 'Me gustaría expresar mi profundo agradecimiento al Dr. […]', '2025-01-07'::date),

    -- Dr. Ralf Baumgartner — Google: 4.6/5, 19 valoraciones.
    ('fb06be62-c807-57ae-ad8b-d44b5bbd73e3'::uuid, '2e27bdbd-c262-414a-b188-ba790f3f7263'::uuid, 'Dr. Ralf Baumgartner', 'Evani Andrade · Google', 1, 'Reservé una cita con el Dr. Ralf. llamé tres días […]', '2023-10-02'::date),
    ('3ae8ceae-a865-55f4-a84a-e7fc47166431'::uuid, '2e27bdbd-c262-414a-b188-ba790f3f7263'::uuid, 'Dr. Ralf Baumgartner', 'Cristina Serpa · Google', 5, 'El Dr. Ralf es un médico maravilloso, muy atento además. […]', '2023-01-06'::date),
    ('39761b07-d033-573d-a73c-bf731df98fd3'::uuid, '2e27bdbd-c262-414a-b188-ba790f3f7263'::uuid, 'Dr. Ralf Baumgartner', 'Carmen Vila · Google', 5, 'Excelente, competente, comprensivo. Durante toda mi estadía en Zürich (aproximadamente […]', '2020-08-09'::date),
    ('51f3a2fd-f694-59e6-ac0d-e78ec0cf7713'::uuid, '2e27bdbd-c262-414a-b188-ba790f3f7263'::uuid, 'Dr. Ralf Baumgartner', 'Barbara Baer · Google', 5, 'Altamente recomendado. Sensible y muy comprensiva. ¡Competente y servicial! […]', '2018-02-08'::date),
    ('d184965e-2439-59c2-a0fe-954f6da0ae78'::uuid, '2e27bdbd-c262-414a-b188-ba790f3f7263'::uuid, 'Dr. Ralf Baumgartner', 'Agnieszka Jaggy · Google', 5, '¡Un médico excelente, paciente, altamente calificado, amigable y con corazón! Recomendado […]', '2021-06-06'::date),
    ('a0e49b51-e0d4-5238-a567-cfefc7344f7b'::uuid, '2e27bdbd-c262-414a-b188-ba790f3f7263'::uuid, 'Dr. Ralf Baumgartner', 'Débora Brito · Google', 5, 'Excelente ginecólogo, llevo 2 años con él.', '2022-11-01'::date),
    ('d8bd4d32-4e1d-570e-aebe-4965739ca272'::uuid, '2e27bdbd-c262-414a-b188-ba790f3f7263'::uuid, 'Dr. Ralf Baumgartner', 'Clebia Pircher-Duarte · Google', 5, 'Muy bien', '2024-07-10'::date),

    -- Dr. Roger Eltbogen — Google: 3.9/5, 10 valoraciones.
    ('54dcf4f6-b79b-5b0b-aa02-a77099eb9190'::uuid, 'b114805e-90fd-4195-abf1-1d0d105e769c'::uuid, 'Dr. Roger Eltbogen', 'Sarah Christandl · Google', 5, 'Sólo puedo reportar cosas positivas. El Dr. Eltbogen es para mí. […]', '2025-03-19'::date),
    ('70fa4514-7350-597a-aa48-d20237776edb'::uuid, 'b114805e-90fd-4195-abf1-1d0d105e769c'::uuid, 'Dr. Roger Eltbogen', 'S. Malica · Google', 5, 'El Dr. Eltbogen es un muy buen ginecólogo que también trata a mujeres jóvenes. […]', '2024-12-04'::date),
    ('e119a72d-7b39-55c6-a47d-c2f7fb20e4b7'::uuid, 'b114805e-90fd-4195-abf1-1d0d105e769c'::uuid, 'Dr. Roger Eltbogen', 'cat tallica · Google', 1, '¡¡¡Deberíamos aprender que las tabletas no son ositos de goma!!! No escucha correctamente […]', '2024-11-23'::date),
    ('646fbd34-0191-5e7f-a828-3673a905f6c3'::uuid, 'b114805e-90fd-4195-abf1-1d0d105e769c'::uuid, 'Dr. Roger Eltbogen', 'Daniela Squitieri · Google', 5, 'Son médicos y tal vez puedan estar equivocados. sí […]', '2024-12-04'::date),
    ('b013f085-7738-580a-a4be-b94a6b813fe3'::uuid, 'b114805e-90fd-4195-abf1-1d0d105e769c'::uuid, 'Dr. Roger Eltbogen', 'Fabienne Zimmermann · Google', 1, 'Se había comportado de tal manera que mi hijo podía hacer eso. […]', '2025-03-22'::date),

    -- Dr. Roland Laager — Google: 4.8/5, 30 valoraciones.
    ('c6273390-360f-5e5e-ad54-d1ca5432c46c'::uuid, '06d653a7-fbe5-44c8-ad54-f15b38875e2f'::uuid, 'Dr. Roland Laager', 'Kristina Lajsic · Google', 5, 'Dr. Medicina. Ronald Laager-Mayer es un gran médico. Profesional […]', '2020-08-09'::date),
    ('b0df399b-2f8c-5e54-ab51-32e6369577e7'::uuid, '06d653a7-fbe5-44c8-ad54-f15b38875e2f'::uuid, 'Dr. Roland Laager', 'Mikhail Kuzmin · Google', 5, '¡Excelente pediatra! Habla muy bien inglés, es muy pragmático con las opciones de tratamiento. […]', '2022-01-17'::date),
    ('40b88442-8839-5613-ac7f-c2605cff279f'::uuid, '06d653a7-fbe5-44c8-ad54-f15b38875e2f'::uuid, 'Dr. Roland Laager', 'Edyta Augustynowicz · Google', 5, 'Tuve el placer de visitar una vez al Dr. Laager con […]', '2018-07-11'::date),
    ('4ab8d3ac-ce96-5346-aa62-56b47251a937'::uuid, '06d653a7-fbe5-44c8-ad54-f15b38875e2f'::uuid, 'Dr. Roland Laager', 'Juli CF · Google', 5, 'Gran doctor. No sonríe, pero hace exámenes, lo cual es mucho […]', '2016-11-29'::date),
    ('337f2a9c-7163-5d45-a3ce-509c0de2b309'::uuid, '06d653a7-fbe5-44c8-ad54-f15b38875e2f'::uuid, 'Dr. Roland Laager', 'Katja Pulver · Google', 5, 'Tengo tres hijos y el Dr. Laager ha sido desde su nacimiento. […]', '2022-03-21'::date),
    ('72a0a4b3-0a39-59b8-a9fc-649c507fa2ae'::uuid, '06d653a7-fbe5-44c8-ad54-f15b38875e2f'::uuid, 'Dr. Roland Laager', 'Burcu Coskun · Google', 5, 'Mis dos hijos han sido tratados por el Dr. Laager desde su nacimiento. […]', '2024-06-17'::date),
    ('179fc7a1-e7f2-56a4-a581-c68bc3627ac9'::uuid, '06d653a7-fbe5-44c8-ad54-f15b38875e2f'::uuid, 'Dr. Roland Laager', 'Christian Frieden · Google', 1, 'Muy mal organizado administrativamente. Las secretarias tardan demasiado […]', '2019-03-04'::date),
    ('c5739cc7-5cb3-54c7-a55f-f6868581f8c6'::uuid, '06d653a7-fbe5-44c8-ad54-f15b38875e2f'::uuid, 'Dr. Roland Laager', 'Leonie Gysin · Google', 5, 'He estado en buenas manos aquí durante años y puedo […]', '2019-07-25'::date),

    -- Dr. Xavier Tenorio — Google: 3.9/5, 37 valoraciones.
    ('b65f7544-22bd-5517-aa4c-cab65e353e9c'::uuid, '4efbd02a-2d16-439f-bb1a-37d6e51c3f19'::uuid, 'Dr. Xavier Tenorio', 'julia b · Google', 1, 'Desafortunadamente, no puedo recomendar a este cirujano en absoluto. […]', '2023-04-20'::date),
    ('77e5d16a-d602-50f1-a910-38275cab746b'::uuid, '4efbd02a-2d16-439f-bb1a-37d6e51c3f19'::uuid, 'Dr. Xavier Tenorio', 'Anouk Meslin · Google', 5, 'El Dr. Tenorio siempre fue un buen oyente. Él tiene […]', '2020-03-17'::date),

    -- Dra. Daniela Baur-Günter — Google: 4.0/5, 57 valoraciones.
    ('4e263a9b-aa33-55b1-a32f-1c7c26993dcc'::uuid, '5274423c-5c1b-4a98-a096-167b93026a6d'::uuid, 'Dra. Daniela Baur-Günter', 'Rina Hoshino · Google', 5, 'Estoy muy contento con mi experiencia con el Dr. Baur. […]', '2025-03-14'::date),
    ('9e15321d-e623-524b-a138-23a3f7f4db17'::uuid, '5274423c-5c1b-4a98-a096-167b93026a6d'::uuid, 'Dra. Daniela Baur-Günter', 'M. · Google', 5, 'Las cinco estrellas van de todo corazón al médico. […]', '2025-02-10'::date),
    ('54e4b2a6-7f3f-597e-a98a-46e0ebcb8dec'::uuid, '5274423c-5c1b-4a98-a096-167b93026a6d'::uuid, 'Dra. Daniela Baur-Günter', 'Family Schenk · Google', 5, 'Llevo varios años con el señor Baur. […]', '2023-07-02'::date),

    -- Dra. Eva Haller — Google: 4.8/5, 20 valoraciones.
    ('68eb07d8-8f9d-56d0-aa49-02998da3cc81'::uuid, '636460d8-e656-4da8-a013-199fb83c35e5'::uuid, 'Dra. Eva Haller', 'Fina A. · Google', 5, 'Recomiendo ampliamente esta práctica. Un pequeño oasis bellamente diseñado con […]', '2024-09-13'::date),
    ('071d52e3-cec9-5c14-a1b3-16b820a25b99'::uuid, '636460d8-e656-4da8-a013-199fb83c35e5'::uuid, 'Dra. Eva Haller', 'Aissatou Sylla · Google', 5, 'El Dr. Trensz me siguió durante mi primer embarazo. […]', '2024-09-24'::date),
    ('a18d1b09-40ca-5ec6-a239-a85675bea5f9'::uuid, '636460d8-e656-4da8-a013-199fb83c35e5'::uuid, 'Dra. Eva Haller', 'Maria · Google', 5, 'El Dr. Haller ha sido mi médico durante mi primer embarazo y […]', '2024-07-23'::date),
    ('07f36d04-8c0e-58f0-af2a-c8403170ee24'::uuid, '636460d8-e656-4da8-a013-199fb83c35e5'::uuid, 'Dra. Eva Haller', 'alyshawalks · Google', 5, 'Tuve una gran experiencia con Juliane Trensz. ella tenia […]', '2024-05-29'::date),
    ('a8c53aca-5c81-5ce7-ac2a-3d7a71701923'::uuid, '636460d8-e656-4da8-a013-199fb83c35e5'::uuid, 'Dra. Eva Haller', 'Dimitrios Leontaris · Google', 1, 'Praxis Inútil Dos veces mi esposa fue al ginecólogo y […]', '2024-08-22'::date),
    ('796e4751-4440-54d3-a628-b80a64c25f43'::uuid, '636460d8-e656-4da8-a013-199fb83c35e5'::uuid, 'Dra. Eva Haller', 'Manuel · Google', 5, 'Súper feliz con el Dr. Haller, que está muy bien informado y es amigable. […]', '2024-04-02'::date),
    ('64817b63-aa73-5cc1-a298-70a5350d6374'::uuid, '636460d8-e656-4da8-a013-199fb83c35e5'::uuid, 'Dra. Eva Haller', 'Rokhaya BEYE · Google', 5, 'El Dr. Trensz me siguió durante mi primer embarazo. […]', '2024-10-25'::date),

    -- Dra. Fabiana Jorge — Google: 4.6/5, 23 valoraciones.
    ('ec0cd86c-d4a1-5bc5-a95b-762e5ef2ae31'::uuid, '3c582d5c-5f74-49eb-a1be-d293c9ed79a3'::uuid, 'Dra. Fabiana Jorge', 'stuart Cutts · Google', 5, 'Soy MUY exigente con los dentistas como he tenido. […]', '2020-10-05'::date),
    ('bd90337f-567b-5ba4-a6ce-116fe2edd24a'::uuid, '3c582d5c-5f74-49eb-a1be-d293c9ed79a3'::uuid, 'Dra. Fabiana Jorge', 'Gianluca Bellu · Google', 5, 'He estado en Praxis muy a menudo en los últimos […]', '2022-04-12'::date),
    ('41bb147f-01eb-5249-abaf-8f26e2114b31'::uuid, '3c582d5c-5f74-49eb-a1be-d293c9ed79a3'::uuid, 'Dra. Fabiana Jorge', 'Daniela Meier · Google', 5, 'Estoy muy satisfecho con esta práctica dental. Conduce más de 1 hora […]', '2025-05-06'::date),
    ('6b62cdbc-654d-5c94-aed0-7ab5298170ca'::uuid, '3c582d5c-5f74-49eb-a1be-d293c9ed79a3'::uuid, 'Dra. Fabiana Jorge', 'Patricia Santos Branding Studio · Google', 5, 'Tuve una excelente experiencia con el Dr Jorge. Servicio práctico, […]', '2024-07-16'::date),
    ('55634fd3-f99e-5007-a91e-20ec37f1e8d8'::uuid, '3c582d5c-5f74-49eb-a1be-d293c9ed79a3'::uuid, 'Dra. Fabiana Jorge', 'Marcel Alexandre Fenerich · Google', 5, 'Hace poco fui al consultorio dental de Fabiana Jorge para un tratamiento de conducto […]', '2023-11-29'::date),
    ('c34d76ed-be1e-5697-a0b0-90ffb1d0e730'::uuid, '3c582d5c-5f74-49eb-a1be-d293c9ed79a3'::uuid, 'Dra. Fabiana Jorge', 'Yara Souza · Google', 5, 'Recibí muy buen servicio desde la primera llamada. comencé el […]', '2023-01-20'::date),

    -- Dra. Lissy Antunez — Google: 4.7/5, 43 valoraciones.
    ('716041d1-0165-598b-ad2e-d09e941a1644'::uuid, '7974d11e-fe7f-4442-a162-359938143670'::uuid, 'Dra. Lissy Antunez', 'Nayara · Google', 5, '¡Dra Lissy fue el regalo más grande que pudimos tener! A […]', '2024-10-29'::date),
    ('6617908f-d18a-5829-ac03-82de2720bfe8'::uuid, '7974d11e-fe7f-4442-a162-359938143670'::uuid, 'Dra. Lissy Antunez', 'Fernanda Moreno · Google', 5, 'Un excelente profesional y una increíble persona. ella me siguió […]', '2023-04-05'::date),
    ('d781f344-b26c-50a7-a3d1-73193c9a27da'::uuid, '7974d11e-fe7f-4442-a162-359938143670'::uuid, 'Dra. Lissy Antunez', 'Geneisa Rengel · Google', 1, 'La recepcionista que atiende. Fatal. No te escuchan, […]', '2024-09-18'::date),
    ('c0916e5a-a89a-5e2d-a531-03217df039a2'::uuid, '7974d11e-fe7f-4442-a162-359938143670'::uuid, 'Dra. Lissy Antunez', 'Silvia S · Google', 5, 'La mejor experiencia en mi embarazo. El médico y el equipo están […]', '2023-04-13'::date),
    ('ca14590f-5b3c-5742-a6c9-ec1f6d18e25b'::uuid, '7974d11e-fe7f-4442-a162-359938143670'::uuid, 'Dra. Lissy Antunez', 'Clémence Vauzelle · Google', 5, 'Increíble doctor y equipo.', '2024-04-12'::date),
    ('a3025bba-a68d-5362-a034-c2ce8aac2291'::uuid, '7974d11e-fe7f-4442-a162-359938143670'::uuid, 'Dra. Lissy Antunez', 'Maria Isabel Kessler · Google', 5, 'Muchas gracias Dra. Antunez Lissy quien la atendió muy bien. […]', '2023-04-04'::date),
    ('3bd13374-8d6a-53a5-ab83-94fab00cccef'::uuid, '7974d11e-fe7f-4442-a162-359938143670'::uuid, 'Dra. Lissy Antunez', 'Chrytiane bercini · Google', 5, 'El Dr. Antunez es un doctor increíble, realmente lo aprecio. […]', '2025-03-17'::date),
    ('dfc13b9e-448c-5a96-a198-cb3b67334d30'::uuid, '7974d11e-fe7f-4442-a162-359938143670'::uuid, 'Dra. Lissy Antunez', 'Anni Mu · Google', 5, 'He estado con el Dr. por más de 8 años. Antúnez y […]', '2024-10-30'::date),

    -- Dra. María Rosa Leivas — Google: 4.3/5, 25 valoraciones.
    ('6b683863-a5fe-5a6f-a950-44d5b7819ee0'::uuid, '4b45d2b6-9137-4e1e-8b8d-5f81948201fe'::uuid, 'Dra. María Rosa Leivas', 'agostina spinelli · Google', 5, 'Muy buen profesional! Dra Leivas y su personal. Siempre capaz […]', '2022-12-14'::date),
    ('93e2cf5d-82e3-501e-a0d2-194d18f6936d'::uuid, '4b45d2b6-9137-4e1e-8b8d-5f81948201fe'::uuid, 'Dra. María Rosa Leivas', 'Marina Ropero García-Arroba · Google', 1, 'Fui paciente durante más de dos años y lamentablemente no puedo. […]', '2024-08-02'::date),
    ('4772a81b-b418-529b-a226-1397ea4724ba'::uuid, '4b45d2b6-9137-4e1e-8b8d-5f81948201fe'::uuid, 'Dra. María Rosa Leivas', 'Adrians Rahali-Wicki · Google', 5, 'Estuve allí por primera vez hace unos 6 años. […]', '2022-12-14'::date),
    ('bc75cf1a-2cfd-58b6-a4ba-fcc793c55381'::uuid, '4b45d2b6-9137-4e1e-8b8d-5f81948201fe'::uuid, 'Dra. María Rosa Leivas', 'Da Silva Sousa Maria (Keine) · Google', 5, 'Estoy MUY SATISFECHO con la Dra. Leivas Ella es para […]', '2025-01-07'::date),

    -- Dra. Marina Portela — Google: 5.0/5, 6 valoraciones.
    ('9fe365df-5e78-5d19-a093-2d430772f3c2'::uuid, '01d45e8b-00c6-442a-869c-05d2f0f4bc6c'::uuid, 'Dra. Marina Portela', 'Isabelle V. · Google', 5, 'El Dr. Portela fue muy atento y amable. una consulta […]', '2024-09-20'::date),

    -- Dra. Michaela Schmid — Google: 3.9/5, 31 valoraciones.
    ('e422ac06-cbb7-5264-afd6-8ea6662954d4'::uuid, '797a4f48-17f2-42ab-a52f-c80d3b8bf71d'::uuid, 'Dra. Michaela Schmid', 'chiara zanin · Google', 5, 'El Dr. Schmid es un obstetra-ginecólogo muy competente, me ha seguido […]', '2021-05-28'::date),
    ('1a653b60-0950-56b9-a99f-427a63563baf'::uuid, '797a4f48-17f2-42ab-a52f-c80d3b8bf71d'::uuid, 'Dra. Michaela Schmid', 'H. Chun · Google', 1, 'Tuve una experiencia terrible aquí. fue para mi […]', '2024-01-30'::date),
    ('eb630350-4fd7-5101-a995-0ca12fcd1505'::uuid, '797a4f48-17f2-42ab-a52f-c80d3b8bf71d'::uuid, 'Dra. Michaela Schmid', 'Romain Gioux · Google', 1, 'Pésima experiencia, tuvimos que cambiar de ginecólogo a los 6 meses. […]', '2023-01-09'::date),
    ('dd18f23b-b323-5762-a0d1-5b55a087dcd8'::uuid, '797a4f48-17f2-42ab-a52f-c80d3b8bf71d'::uuid, 'Dra. Michaela Schmid', 'katerina chel.var. · Google', 5, 'Estuve viendo a Michaela durante mi primer embarazo y todo. […]', '2021-02-12'::date),
    ('0294f67e-5a58-5caa-ad56-0f92cb5a8362'::uuid, '797a4f48-17f2-42ab-a52f-c80d3b8bf71d'::uuid, 'Dra. Michaela Schmid', 'Gudrun &Fam · Google', 5, 'Con el Dr. me siento en buenas manos con Schmid. Ella […]', '2025-04-16'::date),
    ('49e43324-c7d6-5757-a199-1193ded2c8a9'::uuid, '797a4f48-17f2-42ab-a52f-c80d3b8bf71d'::uuid, 'Dra. Michaela Schmid', 'Sophia Oppmann · Google', 4, 'Tengo a la Sra. Dra. Schmid como muy empática, amigable y […]', '2025-04-29'::date),
    ('1500764e-6949-5218-afd1-af94e8a893e0'::uuid, '797a4f48-17f2-42ab-a52f-c80d3b8bf71d'::uuid, 'Dra. Michaela Schmid', 'Nina · Google', 1, 'Desgraciadamente tuve una muy mala experiencia con la señora Schmid. […]', '2025-02-05'::date),

    -- Dra. Nuria García Segarra — Google: 3.9/5, 14 valoraciones.
    ('b2b6c214-a355-56c4-afca-f5eeadfe5a0e'::uuid, 'a883b41f-69f8-4c72-b1d0-9e4046e55e53'::uuid, 'Dra. Nuria García Segarra', 'Audrey · Google', 1, 'A lo largo de todas mis interacciones, encontré que su comportamiento era […]', '2025-04-29'::date),
    ('8e6c95e7-9b1b-5334-ad75-e9827ba5b915'::uuid, 'a883b41f-69f8-4c72-b1d0-9e4046e55e53'::uuid, 'Dra. Nuria García Segarra', 'Céline Erriquez · Google', 5, 'Mis 4 hijos, de 3 y 5 años respectivamente, […]', '2025-05-07'::date),
    ('168aa4af-a624-56c8-a58a-b04dd7143416'::uuid, 'a883b41f-69f8-4c72-b1d0-9e4046e55e53'::uuid, 'Dra. Nuria García Segarra', 'Grégoire Oberle · Google', 5, 'Cariñosa y extremadamente amable con los niños. ella esta especializada […]', '2025-06-01'::date),
    ('b276af06-8a6e-5e69-a799-0e669911424e'::uuid, 'a883b41f-69f8-4c72-b1d0-9e4046e55e53'::uuid, 'Dra. Nuria García Segarra', 'Myriam Delouvrier · Google', 5, 'Excelente pediatra!!! Extremadamente concienzudo, muy atento a los detalles, un verdadero […]', '2025-05-17'::date),
    ('6279b0e4-fa49-54b2-a358-10f16f0f5d1a'::uuid, 'a883b41f-69f8-4c72-b1d0-9e4046e55e53'::uuid, 'Dra. Nuria García Segarra', 'Candice Mazoyer · Google', 5, 'Gran pediatra que se toma su tiempo. Gentil y atento. […]', '2024-11-28'::date),
    ('5f08ee0e-927d-502a-a8cb-7f8399e74428'::uuid, 'a883b41f-69f8-4c72-b1d0-9e4046e55e53'::uuid, 'Dra. Nuria García Segarra', 'Moona Joye · Google', 1, 'La Dra Nuria García Segarra te lo desaconseja!!! ya voy […]', '2018-10-18'::date),
    ('763e0d95-507e-5c01-abe2-08a85ce68467'::uuid, 'a883b41f-69f8-4c72-b1d0-9e4046e55e53'::uuid, 'Dra. Nuria García Segarra', 'mooa sam · Google', 1, 'La pediatra Núria García incompetente y codiciosa de dinero (ofrece ayuda […]', '2018-10-12'::date),
    ('ed755909-c3d1-5130-a947-f46dce803683'::uuid, 'a883b41f-69f8-4c72-b1d0-9e4046e55e53'::uuid, 'Dra. Nuria García Segarra', 'hani guled · Google', 1, 'Muy altiva y no toma en consideración a sus pacientes. Ella […]', '2025-03-28'::date),

    -- Embajada de España en Berna — Google: 2.7/5, 38 valoraciones.
    ('b994bb4d-5cae-50e3-adf1-2945160be0f8'::uuid, '65a63e20-bdb2-4bc8-b41c-f79e75f8ee4f'::uuid, 'Embajada de España en Berna', 'Royal Ticino · Google', 1, 'El agente del call center colgó nuestra llamada desde el 31 de enero de 2022 sin motivo alguno. Nuestro […]', '2022-01-31'::date),
    ('03c83c3d-d092-5822-a0bf-c1ec68fae4c6'::uuid, '65a63e20-bdb2-4bc8-b41c-f79e75f8ee4f'::uuid, 'Embajada de España en Berna', 'Maria Sabato · Google', 1, 'Mi madre se puso en contacto con el consulado en Berna esta mañana. […]', '2022-09-26'::date),
    ('3f6f2f07-e8dc-53ea-acbc-ba8bd1bab94b'::uuid, '65a63e20-bdb2-4bc8-b41c-f79e75f8ee4f'::uuid, 'Embajada de España en Berna', 'Susi Lopez · Google', 5, 'Hoy hemos ido a Berna (con cita previa) y nos […]', '2023-02-28'::date),
    ('45e0234c-c175-5011-a033-3e0b18498c2c'::uuid, '65a63e20-bdb2-4bc8-b41c-f79e75f8ee4f'::uuid, 'Embajada de España en Berna', 'Rafael Candela · Google', 3, 'Pongo un 3 y justifico mi valoración. Llamé hace 1 […]', '2016-09-06'::date),
    ('bb3e7731-21e8-57d5-ab5a-bc3a40f2c517'::uuid, '65a63e20-bdb2-4bc8-b41c-f79e75f8ee4f'::uuid, 'Embajada de España en Berna', 'susana cebrian · Google', 1, 'La persona que cojo el telefono,no te deja hablar, intentaba […]', '2022-01-31'::date),
    ('04743c42-6f66-573f-ad72-55dc85044f6d'::uuid, '65a63e20-bdb2-4bc8-b41c-f79e75f8ee4f'::uuid, 'Embajada de España en Berna', 'Rey · Google', 1, '¡Qué club tan desastroso! No se responden correos electrónicos ni llamadas […]', '2023-02-16'::date),

    -- Embajada de México en Suiza — Google: 3.6/5, 90 valoraciones.
    ('6ad61c46-9878-536f-a64b-4d7fac3c7e4b'::uuid, 'fe2fa80e-5f85-4034-aceb-c1ae11154868'::uuid, 'Embajada de México en Suiza', 'npg 1231 · Google', 5, 'Personal muy amable y solidario. He solicitado dos veces […]', '2025-01-28'::date),
    ('561c5685-19b1-5152-a118-c0a2bd860e88'::uuid, 'fe2fa80e-5f85-4034-aceb-c1ae11154868'::uuid, 'Embajada de México en Suiza', 'Raj Rupnawar · Google', 5, 'Personal muy amable y solidario. El tiempo de procesamiento de visas es rápido. […]', '2025-03-13'::date),
    ('e51f1353-dd5d-5a4b-ad77-eddac385e9a3'::uuid, 'fe2fa80e-5f85-4034-aceb-c1ae11154868'::uuid, 'Embajada de México en Suiza', 'Claudio Ramirez · Google', 5, 'Como siempre, acabamos de recibir una respuesta muy efectiva y rápida. […]', '2025-03-18'::date),
    ('06975060-1b66-5102-a711-64e25fe00bd6'::uuid, 'fe2fa80e-5f85-4034-aceb-c1ae11154868'::uuid, 'Embajada de México en Suiza', 'Daniel Partida · Google', 2, 'Personal muy antipático, confrontando y tratando a las personas de manera grosera. […]', '2024-07-23'::date),
    ('0d659596-8277-5cbd-ac51-6e4d0d5d72d6'::uuid, 'fe2fa80e-5f85-4034-aceb-c1ae11154868'::uuid, 'Embajada de México en Suiza', 'Adrian Roth · Google', 5, 'Gran servicio. La embajada está muy organizada y todo funcionó. […]', '2021-07-08'::date),
    ('cd3b6da9-7f99-5688-ac0f-eba335859d83'::uuid, 'fe2fa80e-5f85-4034-aceb-c1ae11154868'::uuid, 'Embajada de México en Suiza', 'Joshua Mueller · Google', 4, 'Rápido y muy amigable. Una vez allí, muy servicial y amable. […]', '2021-09-02'::date),

    -- Embajada y Sección Consular de Argentina — Google: 4.0/5, 83 valoraciones.
    ('92ab867f-440b-5d2c-a7e5-4a1b73600cc9'::uuid, 'fc3d8235-5122-4048-920c-54457043c95f'::uuid, 'Embajada y Sección Consular de Argentina', 'Matteo Porta · Google', 1, 'Un consulado debe entender que la gente viene de todas partes […]', '2025-03-26'::date),
    ('c8065d24-02ac-5b5c-a59e-7f0cb62b9e37'::uuid, 'fc3d8235-5122-4048-920c-54457043c95f'::uuid, 'Embajada y Sección Consular de Argentina', 'Emma Korenhof · Google', 1, 'Nos llevaron aquí en marzo desde Zurich con nuestro […]', '2024-09-01'::date),

    -- Express Personal — Basilea — Google: 4.7/5, 76 valoraciones.
    ('63c8c0d0-7e58-5c56-acfa-c078a9a66c97'::uuid, '032d2e73-3e8e-4c7a-b872-5d8f3c41f761'::uuid, 'Express Personal — Basilea', 'Jelena Jovanovic · Google', 5, 'Reclutador increíble, súper educado y profesional. ¡Arriba!', '2023-12-16'::date),
    ('84b2761c-0c08-5ddc-ac70-6afaeb998b63'::uuid, '032d2e73-3e8e-4c7a-b872-5d8f3c41f761'::uuid, 'Express Personal — Basilea', 'Lia Zavraznaia · Google', 5, 'ARRIBA !', '2022-04-05'::date),
    ('2189fa8f-7d77-5bea-a8c6-bbbab41085bf'::uuid, '032d2e73-3e8e-4c7a-b872-5d8f3c41f761'::uuid, 'Express Personal — Basilea', 'Nick H · Google', 5, 'Estuve con Express Personal de enero a septiembre. […]', '2024-10-03'::date),
    ('a25c7095-cafc-5217-ad62-a6397db40582'::uuid, '032d2e73-3e8e-4c7a-b872-5d8f3c41f761'::uuid, 'Express Personal — Basilea', 'N. Foley · Google', 5, 'Son un equipo muy, muy agradable. El proceso de solicitud fue […]', '2020-11-04'::date),

    -- Express Personal — Zúrich — Google: 4.0/5, 8 valoraciones.
    ('bbd42762-51ff-5658-a205-cb3f6586d271'::uuid, '1d09399a-25bf-4560-b2ad-fe76dde48210'::uuid, 'Express Personal — Zúrich', 'Agon Emini · Google', 5, 'Arriba', '2022-09-26'::date),
    ('dfe3f1f8-532e-5525-a737-ce0f1347fdf7'::uuid, '1d09399a-25bf-4560-b2ad-fe76dde48210'::uuid, 'Express Personal — Zúrich', 'Marco Glauser · Google', 5, 'Express Personal superó mis expectativas en todas las áreas. Puntual […]', '2023-03-10'::date),
    ('73b7ba48-d402-58f4-a781-8ab7ed75644f'::uuid, '1d09399a-25bf-4560-b2ad-fe76dde48210'::uuid, 'Express Personal — Zúrich', 'Cédric Bächtold · Google', 5, '¡Los mejores servicios! Avanza', '2022-09-26'::date),
    ('9ee12efb-4d0c-5d41-a62d-66d88cc9f844'::uuid, '1d09399a-25bf-4560-b2ad-fe76dde48210'::uuid, 'Express Personal — Zúrich', 'Artur Ostrr · Google', 3, 'Está todo bien.', '2022-10-28'::date),
    ('1a4d1510-2e76-5479-abe1-a416d14145cc'::uuid, '1d09399a-25bf-4560-b2ad-fe76dde48210'::uuid, 'Express Personal — Zúrich', 'sweizer FromWila · Google', 3, 'Bien', '2022-05-01'::date),

    -- Express Personal AG — Google: 4.0/5, 8 valoraciones.
    ('543a69fc-264b-54fc-a4fe-252323c15a2e'::uuid, '845bb936-ff7f-4e61-9d1e-440c18b65f92'::uuid, 'Express Personal AG', 'Agon Emini · Google', 5, 'Arriba', '2022-09-26'::date),
    ('7b6ec49f-ffbd-5d3e-aa41-0e7fa6db87e0'::uuid, '845bb936-ff7f-4e61-9d1e-440c18b65f92'::uuid, 'Express Personal AG', 'Marco Glauser · Google', 5, 'Express Personal superó mis expectativas en todas las áreas. Puntual […]', '2023-03-10'::date),
    ('989382b3-5961-5369-afbb-504819a1ed71'::uuid, '845bb936-ff7f-4e61-9d1e-440c18b65f92'::uuid, 'Express Personal AG', 'Cédric Bächtold · Google', 5, '¡Los mejores servicios! Avanza', '2022-09-26'::date),
    ('15df3917-f93b-5994-aa65-fbd00811ae8d'::uuid, '845bb936-ff7f-4e61-9d1e-440c18b65f92'::uuid, 'Express Personal AG', 'Artur Ostrr · Google', 3, 'Está todo bien.', '2022-10-28'::date),
    ('21503ed7-53da-5219-a592-8a4418660aca'::uuid, '845bb936-ff7f-4e61-9d1e-440c18b65f92'::uuid, 'Express Personal AG', 'sweizer FromWila · Google', 3, 'Bien', '2022-05-01'::date),

    -- Fahrschule Blumer — Google: 5.0/5, 512 valoraciones.
    ('9b73ae9a-1122-578b-af97-874dd107bbd1'::uuid, 'e64952fb-d5f8-4789-90e8-d5d839ffacef'::uuid, 'Fahrschule Blumer', 'Micaela Diaz · Google', 5, 'Tuve una experiencia realmente positiva con Steven Chamorro. I […]', '2022-12-12'::date),
    ('903eee70-1739-5619-ab20-1fe1da8de385'::uuid, 'e64952fb-d5f8-4789-90e8-d5d839ffacef'::uuid, 'Fahrschule Blumer', 'Nadia González Toniolo · Google', 5, 'Mi experiencia con Steven fue genial. Le explicó todos los […]', '2023-08-17'::date),
    ('49e27020-3727-5089-a00c-ff25e1ca8117'::uuid, 'e64952fb-d5f8-4789-90e8-d5d839ffacef'::uuid, 'Fahrschule Blumer', 'Sergio Holoveski · Google', 5, 'Steven Chamorro es un excelente profesor. Él realmente entró […]', '2023-10-26'::date),
    ('e17c3043-4ce2-533d-ac7b-501717427c97'::uuid, 'e64952fb-d5f8-4789-90e8-d5d839ffacef'::uuid, 'Fahrschule Blumer', 'SUF · Google', 5, 'Gracias por el estilo de enseñanza que me ha permitido. […]', '2024-02-05'::date),

    -- Gestoría Hispano-Suiza — Google: 3.4/5, 7 valoraciones.
    ('8ac40458-7886-5ac6-af29-4828c7a7e3a6'::uuid, '211ab41a-d1b5-4cf1-8b7e-bb154955c679'::uuid, 'Gestoría Hispano-Suiza', 'Joana Ortega Mota · Google', 1, 'No les pongo menos estrellas porque no puedo. Les pregunte […]', '2022-10-27'::date),
    ('b2cf075b-3cc4-5f67-aa24-60663ba362e1'::uuid, '211ab41a-d1b5-4cf1-8b7e-bb154955c679'::uuid, 'Gestoría Hispano-Suiza', 'Ramón Medrano Llamas · Google', 5, 'Son muy agradables y hacen las gestiones más que rápido.', '2016-06-06'::date),

    -- Guardería Infantil Española — Google: 4.2/5, 5 valoraciones.
    ('b63086fd-3935-59ad-aeb0-a03801b774cd'::uuid, '21e958fe-1f49-4881-98d3-e4ce8e4c2308'::uuid, 'Guardería Infantil Española', 'Alejandro Sarmentero · Google', 5, 'Fantástico lugar y personal!', '2024-06-19'::date),

    -- Indeed Suiza — Google: 3.2/5, 38 valoraciones.
    ('16a3b6cc-ea21-5be6-a8b6-ee9ebd97d300'::uuid, '1e07337f-80b6-4bbd-81c0-14eca9d933f1'::uuid, 'Indeed Suiza', 'Arabi Ahmat · Google', 5, 'ABAR Ahmat', '2024-01-02'::date),
    ('e6a1f29e-b90d-5622-a70f-e9f171ef47f3'::uuid, '1e07337f-80b6-4bbd-81c0-14eca9d933f1'::uuid, 'Indeed Suiza', 'Tom Christen · Google', 5, 'Gran equipo, muy profesionales. ¡Malditas buenas repeticiones! Definitivamente lo recomendaría […]', '2019-12-06'::date),
    ('3da6fd24-1de7-5eed-a409-e89ad4eebe99'::uuid, '1e07337f-80b6-4bbd-81c0-14eca9d933f1'::uuid, 'Indeed Suiza', 'Jamie McLaughlan · Google', 5, 'Fantástica experiencia, personal realmente útil, servicial y extremadamente amable.', '2019-12-06'::date),
    ('644c2bc6-7e8b-56bc-a728-2c573752e8de'::uuid, '1e07337f-80b6-4bbd-81c0-14eca9d933f1'::uuid, 'Indeed Suiza', 'Reto Müller · Google', 1, 'Nuestra empresa nunca se registró en Indeed y aún […]', '2019-03-13'::date),
    ('618b0889-4530-507e-a434-2db92c7f4193'::uuid, '1e07337f-80b6-4bbd-81c0-14eca9d933f1'::uuid, 'Indeed Suiza', 'Boris Braun · Google', 1, 'Un anuncio simplemente se publicó sin ninguna solicitud ni nada más. […]', '2022-08-17'::date),

    -- Inovus Job AG — Google: 4.9/5, 141 valoraciones.
    ('42017f92-6264-57bb-a44d-3e25db9fd34f'::uuid, 'beb18456-5729-490d-b8e8-7a5e56ebbf68'::uuid, 'Inovus Job AG', 'aladji camara · Google', 5, 'Buena experiencia hasta el momento, nada de qué quejarse de grandes personas. […]', '2024-07-19'::date),

    -- J&B Personal AG — Google: 3.9/5, 34 valoraciones.
    ('997c2a2b-fcb7-57d6-a5f4-3cfa02d20a89'::uuid, '5faa9261-de46-4c98-827c-3b96b28bbd38'::uuid, 'J&B Personal AG', 'Rolf Sofia · Google', 5, '¡Oficina superior, vendedor superior! Muy sensato. Recomendación Ivan Küttel, hecho […]', '2020-01-08'::date),
    ('553fc968-f53b-51dc-a2e5-7707ce614061'::uuid, '5faa9261-de46-4c98-827c-3b96b28bbd38'::uuid, 'J&B Personal AG', 'Ivan Milosevic · Google', 1, 'El último hoyo. Tan pronto como estás enfermo se ponen descarados. […]', '2019-02-11'::date),

    -- Job 4 You — Google: 4.5/5, 39 valoraciones.
    ('34a2dd04-59c2-5587-a8ec-0d255c44cab2'::uuid, '8b7767bd-c0b4-4da2-89ef-afa77539dd31'::uuid, 'Job 4 You', 'Enko Enil · Google', 5, 'David Santiago es una persona profesional, humana, detallista y que en mi opinión le pone mucho corazón. […]', '2025-01-13'::date),
    ('277add29-cb8a-5d14-a64f-b36c09913cd7'::uuid, '8b7767bd-c0b4-4da2-89ef-afa77539dd31'::uuid, 'Job 4 You', 'domenico parete · Google', 5, '¡Un consejo muy objetivo y competente! El rector es real. […]', '2020-01-14'::date),
    ('7aa15175-e60b-527f-a698-1a7ff2fffb73'::uuid, '8b7767bd-c0b4-4da2-89ef-afa77539dd31'::uuid, 'Job 4 You', 'Cybercake · Google', 5, 'Procedimiento de contratación muy bueno y progresivo. El asesor es B. Probst. […]', '2018-03-28'::date),
    ('ef81f8f5-4064-5daa-a56e-d56913ce82b4'::uuid, '8b7767bd-c0b4-4da2-89ef-afa77539dd31'::uuid, 'Job 4 You', 'Jasi Probst · Google', 5, 'Consultoría de RRHH muy recomendable. El apoyo y el asesoramiento siguen siendo muy importantes aquí. […]', '2019-09-02'::date),
    ('bae1b393-da9b-512c-a4b8-3fe089b17c7f'::uuid, '8b7767bd-c0b4-4da2-89ef-afa77539dd31'::uuid, 'Job 4 You', 'Rogério Portela · Google', 5, 'Conocí Jobs4You a través de Internet. Mi persona de contacto […]', '2019-11-13'::date),
    ('ad9fc1a9-a6c0-5554-a66b-b51b3f6be4bd'::uuid, '8b7767bd-c0b4-4da2-89ef-afa77539dd31'::uuid, 'Job 4 You', 'Κυριακος Καζακης · Google', 1, 'Las personas no son una simple oficina por la que nos burlamos […]', '2023-09-08'::date),

    -- Jobscout24 — Google: 3.5/5, 2 valoraciones.
    ('38d5ddc8-b59c-569d-a3d5-ae814649a6ea'::uuid, 'a7e4711e-03fb-4f03-bbe5-5ba9d66239bd'::uuid, 'Jobscout24', 'Thomas Bachmann · Google', 5, 'Me gustaría agradecerle mucho por la pronta finalización.', '2025-03-13'::date),

    -- Kiebitz — Google: 4.6/5, 27 valoraciones.
    ('8e7d3cc9-fcf0-57b1-a7fe-a2a76a763eb2'::uuid, '4f580b4b-2a8d-4b25-a97c-b0c565835bc2'::uuid, 'Kiebitz', 'Елена Рослякова · Google', 5, 'Enfoque súper profesional!!!!', '2020-06-23'::date),
    ('0d505ae6-cdc4-5791-aaed-444f8af54a45'::uuid, '4f580b4b-2a8d-4b25-a97c-b0c565835bc2'::uuid, 'Kiebitz', 'Jeanine Mathys · Google', 5, 'Tuve la oportunidad de trabajar allí. Siempre tuve muy […]', '2022-11-11'::date),
    ('12fec419-d26f-51a6-ae54-e9436201ab26'::uuid, '4f580b4b-2a8d-4b25-a97c-b0c565835bc2'::uuid, 'Kiebitz', 'Quality Expert · Google', 5, 'Experiencia muy interesante y asesoramiento profesional. Gracias por los nuevos […]', '2022-04-05'::date),
    ('2ff0e63c-e3ba-5571-a102-6f388e8d5197'::uuid, '4f580b4b-2a8d-4b25-a97c-b0c565835bc2'::uuid, 'Kiebitz', 'Roland Hartmann · Google', 5, 'Gran equipo. ¡Aumento apropiado de carga y asesoramiento muy competente! ¡Gracias!', '2020-10-15'::date),

    -- Kita Arcoiris — Google: 4.0/5, 7 valoraciones.
    ('7981d603-8f5f-5ea7-aa6a-36160e2cafc0'::uuid, 'b54bedf6-3308-4fa0-9076-926f959ac50d'::uuid, 'Kita Arcoiris', 'Belen G.A. · Google', 5, 'La mejor guardería en Lucerna. La atención y el amor hacia el […]', '2019-09-04'::date),
    ('4ea5e337-d0d9-554d-a218-bc416b9a7b1b'::uuid, 'b54bedf6-3308-4fa0-9076-926f959ac50d'::uuid, 'Kita Arcoiris', 'Sara GL · Google', 5, 'Fui a conocerla hace unos días y me encantó, el […]', '2023-01-18'::date),
    ('e28704c0-fbc0-56c6-a43d-c54218bf4f8f'::uuid, 'b54bedf6-3308-4fa0-9076-926f959ac50d'::uuid, 'Kita Arcoiris', 'squeexs · Google', 5, 'La mejor guardería de la ciudad de Lucerna. Sólo puedo recomendarlo.', '2019-08-16'::date),

    -- Kita Colorín — Google: 5.0/5, 9 valoraciones.
    ('8aafc5e4-7d5d-5220-a45c-cc377d0b9802'::uuid, '7c851311-b679-452e-acf6-262b40c00e68'::uuid, 'Kita Colorín', 'JU GR · Google', 5, 'Estamos muy contentos con la guardería de nuestros hijos. Es […]', '2024-09-05'::date),
    ('7d42ef43-a977-5177-a7dd-afbcd12c5920'::uuid, '7c851311-b679-452e-acf6-262b40c00e68'::uuid, 'Kita Colorín', 'Mark Gehring · Google', 5, '¡Encantadora guardería con encanto español! mis dos hijos van mucho […]', '2020-11-18'::date),
    ('3d27f228-f001-524e-a9b2-ef00ca7076c4'::uuid, '7c851311-b679-452e-acf6-262b40c00e68'::uuid, 'Kita Colorín', 'Lynn F · Google', 5, 'Nuestros hijos van a la guardería desde que tenían cinco meses. […]', '2021-08-19'::date),
    ('44efdead-9cfe-5cb2-ad8a-494d28dafe34'::uuid, '7c851311-b679-452e-acf6-262b40c00e68'::uuid, 'Kita Colorín', 'Philipp Thomann · Google', 5, 'Excelente guardería con un programa interesante, excelente atención y excelente personal. […]', '2020-10-12'::date),
    ('758048cd-387c-58d6-a99e-2ec0c68ad814'::uuid, '7c851311-b679-452e-acf6-262b40c00e68'::uuid, 'Kita Colorín', 'Erol · Google', 5, 'Gracias!!', '2024-09-06'::date),

    -- Kita zum Waidberg — Google: 5.0/5, 16 valoraciones.
    ('f97a78ef-4353-50b5-ab85-f3e9e445fe67'::uuid, '86de78ed-9e26-4f39-a35a-12af78661ca9'::uuid, 'Kita zum Waidberg', 'Florentin Westermann · Google', 5, 'La guardería germano-española de Waidberg es una verdadera joya […]', '2024-11-21'::date),
    ('fc1c1aa7-cefe-5a00-ae48-0dbda93c5445'::uuid, '86de78ed-9e26-4f39-a35a-12af78661ca9'::uuid, 'Kita zum Waidberg', 'Stefanie · Google', 5, 'Mi hija ha estado yendo a la guardería durante un año y medio. […]', '2023-11-07'::date),
    ('3a2ebfe6-d21b-59d4-aaec-cb5bf77b1768'::uuid, '86de78ed-9e26-4f39-a35a-12af78661ca9'::uuid, 'Kita zum Waidberg', 'Mme Pri · Google', 5, 'Esta guardería es una pequeña joya e incluso si […]', '2024-08-19'::date),
    ('21a5c9d9-50e5-5a2b-a5e7-3d626cf1ae5d'::uuid, '86de78ed-9e26-4f39-a35a-12af78661ca9'::uuid, 'Kita zum Waidberg', 'Christine Steinlin · Google', 5, 'Estaré encantado de recomendarle la guardería alemana-española de Wipkingen. Atentamente […]', '2025-03-02'::date),
    ('281c0feb-3284-5b91-a413-00d6cf563f9b'::uuid, '86de78ed-9e26-4f39-a35a-12af78661ca9'::uuid, 'Kita zum Waidberg', 'Yamila Lozano · Google', 5, 'Lo que destaca de esta Kita es el carácter familiar […]', '2024-06-20'::date),
    ('168bd096-e200-5e55-ac4e-c5ea9584715a'::uuid, '86de78ed-9e26-4f39-a35a-12af78661ca9'::uuid, 'Kita zum Waidberg', 'Eva Künzle · Google', 5, 'Nuestra hija lleva más de un año yendo a la guardería. […]', '2024-06-24'::date),

    -- La Puerta Déménagements — Google: 4.1/5, 82 valoraciones.
    ('2a6964ff-7ffe-5a46-aa4f-9af823ce4e4d'::uuid, 'e6173c1d-958a-4586-a90e-861e529a7e01'::uuid, 'La Puerta Déménagements', 'Adriana Jacinto · Google', 5, 'Buen equipo, con montadores de muebles profesionales, bien coordinados, muy eficientes. […]', '2021-12-10'::date),
    ('27ab744d-04fb-585c-a17c-174e76d7600b'::uuid, 'e6173c1d-958a-4586-a90e-861e529a7e01'::uuid, 'La Puerta Déménagements', 'NR PS · Google', 1, 'Huye de ellos. Harán los dispositivos más baratos, […]', '2022-11-06'::date),
    ('95b47afc-cd21-5729-af18-04a40a998fed'::uuid, 'e6173c1d-958a-4586-a90e-861e529a7e01'::uuid, 'La Puerta Déménagements', 'Guillermo Grant · Google', 5, 'Estoy muy contento con esta empresa, porque son […]', '2025-02-10'::date),
    ('b3f95282-0f33-5d64-a67b-1af7ac62f76a'::uuid, 'e6173c1d-958a-4586-a90e-861e529a7e01'::uuid, 'La Puerta Déménagements', 'Francesca Celletti · Google', 5, 'Excelente servicio, muy flexible y comprensivo. Los precios también son muy […]', '2019-01-09'::date),
    ('6573fcac-fef5-5398-a5d8-981384e2f0f3'::uuid, 'e6173c1d-958a-4586-a90e-861e529a7e01'::uuid, 'La Puerta Déménagements', 'Ettore Boccia · Google', 5, 'Como estudiante, utilicé los servicios de la empresa. […]', '2024-10-03'::date),

    -- Maison Angelito — Ardon — Google: 3.2/5, 6 valoraciones.
    ('47df2c91-52ae-535c-a6bf-5cfaa3a8fc61'::uuid, '62d9c764-510e-43db-be38-2d3e7df1bf64'::uuid, 'Maison Angelito — Ardon', 'Johanna “JOYS” JOYS · Google', 5, 'Los abuelitos no pueden estar mejor atendidos, y cuidados. El […]', '2025-04-13'::date),

    -- MM Personal — Google: 4.7/5, 160 valoraciones.
    ('566b0883-25cf-528c-add1-9468dfbe58dd'::uuid, '4c55b270-aba8-426b-b8a3-ec113dda7268'::uuid, 'MM Personal', 'Benjamin Irabor · Google', 5, 'MM PERSONAL AG es muy útil al proporcionar trabajo a […]', '2025-05-09'::date),
    ('bccdaa64-9abe-59f4-a537-54680c40b9cc'::uuid, '4c55b270-aba8-426b-b8a3-ec113dda7268'::uuid, 'MM Personal', 'iumatsa · Google', 5, 'Es una muy buena oficina temporal, me ayudó. […]', '2024-09-24'::date),
    ('3de5f1b1-0f6f-5397-ae6b-91deeaf1d0d8'::uuid, '4c55b270-aba8-426b-b8a3-ec113dda7268'::uuid, 'MM Personal', 'Rrezart Shehu · Google', 5, 'Hola, quiero conectarme con MM personal., soy […]', '2024-02-17'::date),
    ('65497932-2a79-55a2-a26e-70b8c5bbef3c'::uuid, '4c55b270-aba8-426b-b8a3-ec113dda7268'::uuid, 'MM Personal', 'Sami Blomberg · Google', 1, '¡¡No profesional!! ¡Me llaman! Muy mala actitud…..', '2022-08-04'::date),
    ('82ba8884-1821-5847-a030-1c2c227e0697'::uuid, '4c55b270-aba8-426b-b8a3-ec113dda7268'::uuid, 'MM Personal', 'marco Rüdisühli · Google', 5, 'Arriba👍', '2023-02-20'::date),
    ('1ee67ba4-9844-5cbe-a43e-10b5b209e062'::uuid, '4c55b270-aba8-426b-b8a3-ec113dda7268'::uuid, 'MM Personal', 'Pascal Brunner · Google', 5, '¡Gastar!', '2023-05-10'::date),
    ('de017bd2-f0a8-54d6-a8cc-e8b99bcdbabe'::uuid, '4c55b270-aba8-426b-b8a3-ec113dda7268'::uuid, 'MM Personal', 'cesar orlandini · Google', 5, 'bueno', '2023-08-21'::date),

    -- Moreno Placements SA — Google: 4.6/5, 20 valoraciones.
    ('0be9b27f-5d54-58e0-a50e-ffccfe785604'::uuid, 'fb343eda-d8ab-4982-8423-e5dc010f8d17'::uuid, 'Moreno Placements SA', 'Michel Quintero · Google', 5, 'Currículum', '2025-04-13'::date),
    ('15470a16-4b62-5018-a1f7-92eef052f793'::uuid, 'fb343eda-d8ab-4982-8423-e5dc010f8d17'::uuid, 'Moreno Placements SA', 'Marie Sousa · Google', 5, 'La mejor agencia sin dudarlo. Lo recomiendo 100%. […]', '2024-10-16'::date),
    ('79efcd57-8d28-5dbb-ad4b-70da71f8fac7'::uuid, 'fb343eda-d8ab-4982-8423-e5dc010f8d17'::uuid, 'Moreno Placements SA', 'Malorie · Google', 5, '¡La mejor agencia de colocación! Lo recomiendo mucho.', '2024-10-16'::date),
    ('525bd527-580b-530a-a0c5-eaa4b1e3b64c'::uuid, 'fb343eda-d8ab-4982-8423-e5dc010f8d17'::uuid, 'Moreno Placements SA', 'Leo S.R · Google', 5, 'Buena agencia temporal, muy profesionales. ¡¡¡¡Recomiendo!!!!', '2024-10-17'::date),
    ('8a4fc260-875a-5e43-a328-6de43f0ec008'::uuid, 'fb343eda-d8ab-4982-8423-e5dc010f8d17'::uuid, 'Moreno Placements SA', 'Tania Malecha · Google', 5, 'Una gran empresa, muy atentos, empleados y un […]', '2023-11-24'::date),
    ('8686dc17-f6fd-545e-a50e-5ae02ddd4fe9'::uuid, 'fb343eda-d8ab-4982-8423-e5dc010f8d17'::uuid, 'Moreno Placements SA', 'Davide Molina · Google', 5, 'Muy buena empresa de colocación permanente y temporal.', '2022-08-15'::date),

    -- My Swiss Company — Google: 5.0/5, 4 valoraciones.
    ('a8250875-0e9b-504b-a153-7fe8828ce1cc'::uuid, '202786a7-f92a-47e9-ab75-3dab71cebde5'::uuid, 'My Swiss Company', 'Kunal Fabiani · Google', 5, 'El Sr. Andrés Taracido y su equipo son los más confiables. […]', '2020-10-22'::date),
    ('2a3a8800-fe99-5969-a28d-c8715d61217e'::uuid, '202786a7-f92a-47e9-ab75-3dab71cebde5'::uuid, 'My Swiss Company', 'Famille Rac · Google', 5, 'Han pasado 10 años y estamos contentos de haber elegido […]', '2020-09-28'::date),
    ('e8d1a40c-33c2-5160-ad2d-8666eab7aca3'::uuid, '202786a7-f92a-47e9-ab75-3dab71cebde5'::uuid, 'My Swiss Company', 'Christopher Finnegan · Google', 5, 'Extremadamente profesional, eficiente y confiable. Han ayudado a nuestro negocio. […]', '2020-09-21'::date),

    -- newhome — Google: 4.7/5, 1491 valoraciones.
    ('184f7b5e-d320-588d-a9a2-3dd139ff9191'::uuid, '4950810a-ab32-47ed-9bc1-bf4aaa8299d2'::uuid, 'newhome', 'Marcel Flikweert · Google', 5, 'A través de Newhome encontré el apartamento de mis sueños con vista a […]', '2025-04-29'::date),
    ('3428363a-c83d-5795-a1b4-3d646fd4ea72'::uuid, '4950810a-ab32-47ed-9bc1-bf4aaa8299d2'::uuid, 'newhome', 'guy · Google', 5, 'Alta visibilidad: otras plataformas repiten el anuncio. Excelente prueba gratuita única en la vida. […]', '2024-08-03'::date),
    ('38a343ce-af44-54a7-a36d-b88bdc4ad882'::uuid, '4950810a-ab32-47ed-9bc1-bf4aaa8299d2'::uuid, 'newhome', 'Houida Baazaoui · Google', 5, 'Un muy buen servicio, la presentación de los objetos para […]', '2024-10-31'::date),
    ('4b377a2f-4f92-5300-a799-24d5fd3929e4'::uuid, '4950810a-ab32-47ed-9bc1-bf4aaa8299d2'::uuid, 'newhome', 'Nashwa Al-Anssari · Google', 5, 'Porque responden a mi solicitud en breve y llamaron […]', '2025-05-12'::date),
    ('643e50fa-ea06-55cd-a408-a11d3f84611b'::uuid, '4950810a-ab32-47ed-9bc1-bf4aaa8299d2'::uuid, 'newhome', 'anne wallach · Google', 5, 'Su sitio es fácil de usar y te dan la […]', '2024-07-07'::date),
    ('656b8a13-71fc-52be-a9ba-0cb633f25c92'::uuid, '4950810a-ab32-47ed-9bc1-bf4aaa8299d2'::uuid, 'newhome', 'George Fankhauser · Google', 3, 'La aplicación todavía necesita algo de trabajo, los mapas no son precisos, las propiedades […]', '2024-02-17'::date),
    ('a89ea167-4011-53ea-ae57-0cc8c552924b'::uuid, '4950810a-ab32-47ed-9bc1-bf4aaa8299d2'::uuid, 'newhome', 'Karin Nussbaumer · Google', 5, '¡Excelente alternativa a otros motores de búsqueda de apartamentos o casas!', '2022-06-29'::date),

    -- Physio Servette — Google: 4.9/5, 156 valoraciones.
    ('a85f5d9c-f816-5ea8-a4ce-7b9254c910b5'::uuid, '75c13a6b-3a21-4b80-9dd5-5d35d5937fa3'::uuid, 'Physio Servette', 'Kyle Apostol · Google', 5, 'El Centro de Fisioterapia y Osteopatía Servette se erige como un faro de […]', '2024-04-14'::date),
    ('61b8fcd3-bb14-5b1f-aab4-ecaa2e63c54b'::uuid, '75c13a6b-3a21-4b80-9dd5-5d35d5937fa3'::uuid, 'Physio Servette', 'Asel KG · Google', 5, 'Me considero afortunado de encontrar un fisioterapeuta tan bueno. […]', '2023-04-18'::date),

    -- PhysioDROM — Google: 5.0/5, 21 valoraciones.
    ('f6faabba-de17-56df-a24a-04ade62c22be'::uuid, '3cc13f6d-6fca-4efc-b64d-4c3049870aa7'::uuid, 'PhysioDROM', 'Giuseppe Brühwiler · Google', 5, 'Lo mejor que me ha pasado... en cuanto a fisioterapia. […]', '2025-01-31'::date),
    ('db36230f-5bf1-5260-aecf-ca9592065040'::uuid, '3cc13f6d-6fca-4efc-b64d-4c3049870aa7'::uuid, 'PhysioDROM', 'Fässler David · Google', 5, 'El mejor fisio de la zona. Aquí es donde la salud y […]', '2024-10-31'::date),

    -- Planet Interim Services — Google: 4.3/5, 56 valoraciones.
    ('7a042ba1-c652-5487-a744-97c070dd67c4'::uuid, 'e42418cc-dfa1-4870-8afd-e723ef9caa92'::uuid, 'Planet Interim Services', 'Gregorius Pangestu · Google', 5, '❤️', '2024-04-05'::date),
    ('2879bf0b-bf4f-5ba4-a8ff-5aac4828a228'::uuid, 'e42418cc-dfa1-4870-8afd-e723ef9caa92'::uuid, 'Planet Interim Services', 'Quentin Mercier · Google', 5, 'Súper', '2023-06-22'::date),
    ('67d98ffa-70a2-5308-a874-37a4d00f447f'::uuid, 'e42418cc-dfa1-4870-8afd-e723ef9caa92'::uuid, 'Planet Interim Services', 'oscar Diaz Muñoz · Google', 5, 'Tuve la oportunidad de contactar con Interim Planet recientemente y […]', '2024-10-10'::date),
    ('0224dfbd-c297-5e3f-a209-d5f348fec6a8'::uuid, 'e42418cc-dfa1-4870-8afd-e723ef9caa92'::uuid, 'Planet Interim Services', 'Ramón López García · Google', 5, 'No tendré vida, para agradecer a María y a su […]', '2023-06-20'::date),
    ('e6971361-cfdb-5844-ad89-a9642bf38f67'::uuid, 'e42418cc-dfa1-4870-8afd-e723ef9caa92'::uuid, 'Planet Interim Services', 'Íris Lage · Google', 3, 'soy albañil busco trabajo […]', '2025-01-22'::date),
    ('7200457e-ef91-5460-aeab-501f16d4ef01'::uuid, 'e42418cc-dfa1-4870-8afd-e723ef9caa92'::uuid, 'Planet Interim Services', 'Joaquin Diaz Mingarro · Google', 5, 'Muy Buen trato , atentos y siempre buscan solución para […]', '2023-06-13'::date),
    ('0af9bc66-e2ba-5271-a3e4-61594e67d487'::uuid, 'e42418cc-dfa1-4870-8afd-e723ef9caa92'::uuid, 'Planet Interim Services', 'BlackBird Rider · Google', 1, 'Una experiencia desastrosa el personal de recepción que son la hermana […]', '2021-04-15'::date),
    ('2392e229-e741-5d91-ad1c-6a9d9dfef59b'::uuid, 'e42418cc-dfa1-4870-8afd-e723ef9caa92'::uuid, 'Planet Interim Services', 'Ana Laura · Google', 5, 'Es la agencia de referencia en la colocación de personal para […]', '2020-02-07'::date),

    -- Progress Personal AG — Google: 4.8/5, 41 valoraciones.
    ('910b0ef2-ecad-5383-aeb2-cd65010fc169'::uuid, '87c274c2-e171-4551-9734-bdc6e34aa07e'::uuid, 'Progress Personal AG', 'Christoph Vetsch · Google', 5, 'Refiriéndose a una conversación competente y alentadora con el Sr. Schrepfer. […]', '2025-01-27'::date),
    ('0110dae2-7f2a-5fc4-aaae-d0ba73c7c9f8'::uuid, '87c274c2-e171-4551-9734-bdc6e34aa07e'::uuid, 'Progress Personal AG', 'Mari Müller · Google', 5, 'Les estoy muy agradecido por la oportunidad, las empresas […]', '2022-05-24'::date),
    ('b7c53d47-f347-51c5-a789-785d7f9c9857'::uuid, '87c274c2-e171-4551-9734-bdc6e34aa07e'::uuid, 'Progress Personal AG', 'Franziska Benz · Google', 5, 'Me siento muy cómodo y en buenas manos con el personal de Progress. […]', '2021-01-02'::date),
    ('fa34f9e9-ec9f-5273-a886-edaff3154c45'::uuid, '87c274c2-e171-4551-9734-bdc6e34aa07e'::uuid, 'Progress Personal AG', 'domi240295 · Google', 4, 'Estoy muy satisfecho hasta ahora, se nota. […]', '2022-07-10'::date),

    -- REBER Rechtsanwälte — Spanish Desk — Google: 3.8/5, 17 valoraciones.
    ('172c9967-2dc9-55eb-a080-db15783bdd21'::uuid, '73d43b00-eebb-49fd-85db-8d328560b557'::uuid, 'REBER Rechtsanwälte — Spanish Desk', 'Kamal Faris · Google', 5, 'Fui asistida por la Sra. Beatrice Benz en mi complejo y […]', '2022-10-27'::date),
    ('d7702fce-b160-5769-a009-65a2a4a2558e'::uuid, '73d43b00-eebb-49fd-85db-8d328560b557'::uuid, 'REBER Rechtsanwälte — Spanish Desk', 'Kristina E. · Google', 5, '¡Gracias por tantos años de cooperación altamente competente! solo por […]', '2021-01-03'::date),
    ('554697e8-618b-502d-ac7a-3230a362a3ee'::uuid, '73d43b00-eebb-49fd-85db-8d328560b557'::uuid, 'REBER Rechtsanwälte — Spanish Desk', 'Ana Domínguez · Google', 1, 'Decepción. Les contactamos para que nos redactaran testamentos y otros […]', '2024-03-26'::date),
    ('07df5132-0f90-5232-a4bc-66a840e78496'::uuid, '73d43b00-eebb-49fd-85db-8d328560b557'::uuid, 'REBER Rechtsanwälte — Spanish Desk', 'Albrecht Köhler · Google', 5, 'Estuve en una situación muy difícil durante muchos años. […]', '2023-08-24'::date),
    ('e0c6dc59-151f-5dff-ac0b-19ace659e9ab'::uuid, '73d43b00-eebb-49fd-85db-8d328560b557'::uuid, 'REBER Rechtsanwälte — Spanish Desk', 'Easy Umzüge AG · Google', 1, 'Honestamente tengo que decir que estoy bastante decepcionado. Mío […]', '2023-01-12'::date),

    -- Rister — Google: 5.0/5, 52 valoraciones.
    ('d05d30fb-c2f3-5128-ae9a-93cfbf4c2778'::uuid, 'bbc064a5-cec4-4f75-b8e4-69ccfa26f06c'::uuid, 'Rister', 'Rene IJnema · Google', 5, 'Trabajo con Andrés y su equipo desde hace algunos años. […]', '2025-01-14'::date),
    ('5f7c9d8e-ce15-5526-abbc-0d5916f2154e'::uuid, 'bbc064a5-cec4-4f75-b8e4-69ccfa26f06c'::uuid, 'Rister', 'Fabien Occhipinti · Google', 5, 'Rister SARL fue un gran apoyo para conseguir mi negocio. […]', '2025-05-12'::date),
    ('84c4c968-8ee4-5f9c-a510-c3db57ebe631'::uuid, 'bbc064a5-cec4-4f75-b8e4-69ccfa26f06c'::uuid, 'Rister', 'Dmitry Vorobyov · Google', 5, 'Es nuestra primera experiencia haciendo negocios en el mercado suizo. […]', '2021-02-10'::date),
    ('749953f4-5918-5c22-aa7a-4140e58a7699'::uuid, 'bbc064a5-cec4-4f75-b8e4-69ccfa26f06c'::uuid, 'Rister', 'Cathal Crowley · Google', 5, 'Cambiamos a Rister después de usar uno de los grandes […]', '2020-09-21'::date),
    ('75f5c6d9-c74d-556a-a914-4e27dcd0aa7a'::uuid, 'bbc064a5-cec4-4f75-b8e4-69ccfa26f06c'::uuid, 'Rister', 'Rafael Rios · Google', 5, 'Llevábamos buscando servicios fiduciarios en Ginebra durante […]', '2020-09-28'::date),
    ('667564e5-279e-5be2-abd3-64c0c7a9b18d'::uuid, 'bbc064a5-cec4-4f75-b8e4-69ccfa26f06c'::uuid, 'Rister', 'Dan Esp · Google', 5, 'Durante los últimos años, he usado Rister para fines personales. […]', '2021-05-25'::date),
    ('2183da3a-91d8-5f43-af7c-c60d82b56a92'::uuid, 'bbc064a5-cec4-4f75-b8e4-69ccfa26f06c'::uuid, 'Rister', 'Makram Ebeid · Google', 5, 'Rister ha proporcionado a nuestra empresa un sólido asesoramiento desde el primer momento. […]', '2020-09-25'::date),
    ('cf6b136b-8aa3-5af5-a29f-15153f8ac821'::uuid, 'bbc064a5-cec4-4f75-b8e4-69ccfa26f06c'::uuid, 'Rister', 'Alexander · Google', 5, 'Estoy muy satisfecho con Rister Sàrl. Profesional, experimentado y […]', '2020-09-22'::date),

    -- Saanaryx — Google: 5.0/5, 13 valoraciones.
    ('6d4eb613-056c-5978-a93b-4271684d793d'::uuid, '799ad296-272d-444d-8ec4-c52638273984'::uuid, 'Saanaryx', 'Mireille Kindlimann · Google', 5, 'Los jabones son maravillosos y sólo puedo recomendarlos. Encendedor […]', '2025-06-07'::date),
    ('58a98287-95a6-53f8-a3a0-6d7210593d9d'::uuid, '799ad296-272d-444d-8ec4-c52638273984'::uuid, 'Saanaryx', 'María teresa Masso · Google', 5, 'Excelentes productos naturales. Recomiendo los jabones que tienen aromas naturales. […]', '2024-05-06'::date),
    ('cf358859-d2f9-5087-a5ad-a6b4921be5bc'::uuid, '799ad296-272d-444d-8ec4-c52638273984'::uuid, 'Saanaryx', 'Christian Heinicke · Google', 5, 'Jabón de muy alta calidad elaborado a partir de materias primas naturales. se siente […]', '2024-05-06'::date),
    ('52f454d8-9499-5c97-a078-112e857fe439'::uuid, '799ad296-272d-444d-8ec4-c52638273984'::uuid, 'Saanaryx', 'Joel · Google', 5, 'Los jabones son de muy alta calidad y realmente cuidan mi piel. […]', '2024-05-05'::date),
    ('a3c2c0c2-5f42-5d69-a2e3-de9ffeb9511f'::uuid, '799ad296-272d-444d-8ec4-c52638273984'::uuid, 'Saanaryx', 'Melanie Pfister · Google', 5, 'Grandes jabones hechos a mano. Muy nutritivo para la piel también. […]', '2024-05-06'::date),
    ('8d08b11c-7e4b-517a-a913-409d4c947f73'::uuid, '799ad296-272d-444d-8ec4-c52638273984'::uuid, 'Saanaryx', 'Hayla Maria · Google', 5, 'Rendimiento de precio superior. Me encantan los jabones. El envío también fue sencillo. […]', '2024-05-05'::date),
    ('a7872438-82af-5542-af00-e814d32bce1a'::uuid, '799ad296-272d-444d-8ec4-c52638273984'::uuid, 'Saanaryx', 'Rüfenacht Daniela · Google', 5, 'Ahora con foto 😃 Estoy muy emocionada con mis jabones. […]', '2024-05-22'::date),

    -- Seguro Médico Suiza — Google: 5.0/5, 18 valoraciones.
    ('de413897-0bb3-5267-a530-a5235fccfb88'::uuid, 'cfb7a22c-e480-4dbf-9bab-1b394a1cd02c'::uuid, 'Seguro Médico Suiza', 'Silvia Solano · Google', 5, 'Eva ha sido súper profesional y servicial durante mi salud. […]', '2024-12-06'::date),
    ('2b4c9c11-1157-5f92-a98d-be88d713c44c'::uuid, 'cfb7a22c-e480-4dbf-9bab-1b394a1cd02c'::uuid, 'Seguro Médico Suiza', 'Miguel e Inés Serrano Vargas · Google', 5, 'Cuando llegamos a Suiza y empezamos a buscar un seguro […]', '2024-04-23'::date),
    ('c2a4ae00-84fe-5fad-ac07-e7655fc0f424'::uuid, 'cfb7a22c-e480-4dbf-9bab-1b394a1cd02c'::uuid, 'Seguro Médico Suiza', 'Laura ESValongo · Google', 5, 'Eva es una asesora top. No solo te explica con […]', '2024-04-19'::date),
    ('06ddb84c-0372-5647-a1a9-92d1e89762c3'::uuid, 'cfb7a22c-e480-4dbf-9bab-1b394a1cd02c'::uuid, 'Seguro Médico Suiza', 'Angela Pavon · Google', 5, 'Eva es encantadora y te explica todo de manera muy […]', '2024-05-06'::date),
    ('d3fc45a0-efca-5915-af5b-76439b667920'::uuid, 'cfb7a22c-e480-4dbf-9bab-1b394a1cd02c'::uuid, 'Seguro Médico Suiza', 'Ana Briz · Google', 5, 'Muy recomendable! Eva es super atenta y profesional. Lo explica […]', '2024-03-09'::date),
    ('eb527949-0963-5e94-a068-b564a20d0c6b'::uuid, 'cfb7a22c-e480-4dbf-9bab-1b394a1cd02c'::uuid, 'Seguro Médico Suiza', 'Rubén Márquez García · Google', 5, 'Eva es una gran profesional, simpática y agradable. Me ha […]', '2024-06-27'::date),
    ('1d1f7f3f-39a4-54a4-a824-1b5abee9d66d'::uuid, 'cfb7a22c-e480-4dbf-9bab-1b394a1cd02c'::uuid, 'Seguro Médico Suiza', 'Mariana · Google', 5, 'Estoy encantada con Eva, muy buena profesional, no entendí varias […]', '2022-12-17'::date),
    ('3f169aba-16f2-5d76-a1db-ec553cd067d8'::uuid, 'cfb7a22c-e480-4dbf-9bab-1b394a1cd02c'::uuid, 'Seguro Médico Suiza', 'Andrea Baixauli · Google', 5, 'Eva ha sido muy profesional y a la vez muy […]', '2024-08-09'::date),

    -- SemioticTransfer — Google: 5.0/5, 5 valoraciones.
    ('1845dca9-13be-543e-a62c-85a782ca0fad'::uuid, 'b6209fc5-1e40-4406-ac17-74825d1a0e03'::uuid, 'SemioticTransfer', 'Viktoriia · Google', 5, 'Estoy muy contento con su servicio. Rápido y competente en […]', '2022-05-18'::date),

    -- Spanisch für Kinder — Google: 5.0/5, 5 valoraciones.
    ('3ff26037-2c6b-5899-ab61-22a892323be6'::uuid, '2a718b42-69ad-4d30-90de-40a1adfafa65'::uuid, 'Spanisch für Kinder', 'Alejandro and Marika Manzanares · Google', 5, 'Mónica lleva muchos años acompañando a mis hijos con el español […]', '2024-02-05'::date),
    ('4706c85a-e8bc-550f-ad30-59026e759dfd'::uuid, '2a718b42-69ad-4d30-90de-40a1adfafa65'::uuid, 'Spanisch für Kinder', 'Alicia Lusarreta · Google', 5, 'Conozco a Mónica desde hace muchos años y solo puedo […]', '2020-10-15'::date),

    -- Spitex Stadt Luzern — Google: 3.3/5, 12 valoraciones.
    ('0dac816e-3807-5f6d-abf3-3047cf1233d3'::uuid, '9b978d99-ab8c-400e-a77c-8eb156bb6967'::uuid, 'Spitex Stadt Luzern', 'O · Google', 5, 'La ciudad Spitex de Lucerna y especialmente el servicio de puentes son un gran apoyo. […]', '2020-03-16'::date),
    ('eec5d6f4-8e10-5ab5-ae84-a49535670e5b'::uuid, '9b978d99-ab8c-400e-a77c-8eb156bb6967'::uuid, 'Spitex Stadt Luzern', 'Mr. Wasteland · Google', 5, 'Sólo puedo recomendar la ciudad Spitex de Lucerna. […]', '2023-09-08'::date),
    ('2d9b929c-d060-5fe3-a5f8-0681c55e0922'::uuid, '9b978d99-ab8c-400e-a77c-8eb156bb6967'::uuid, 'Spitex Stadt Luzern', 'I. K. · Google', 1, 'Puro caos recomiendo mucho que otros pacientes elijan otro […]', '2024-10-25'::date),
    ('bfb43b06-5691-543b-a0db-f8d6d22e188c'::uuid, '9b978d99-ab8c-400e-a77c-8eb156bb6967'::uuid, 'Spitex Stadt Luzern', 'MrMajorasOcarina · Google', 1, 'Organización miserable, Spitex no se preocupa en absoluto por los pacientes […]', '2023-06-30'::date),
    ('a00bc385-c3f9-5542-a73f-975dd915fb08'::uuid, '9b978d99-ab8c-400e-a77c-8eb156bb6967'::uuid, 'Spitex Stadt Luzern', 'rene baumann · Google', 1, 'Lo ignoran de manera hostil a pesar de la orden del médico. nunca más... uno mejor […]', '2023-08-25'::date),

    -- Spitex24 — Aarau — Google: 4.3/5, 14 valoraciones.
    ('c8efe371-2010-5053-ae4b-3eb911a7ee8b'::uuid, '956e7cdf-cbe9-4264-80e0-88fa575baa29'::uuid, 'Spitex24 — Aarau', 'Marko Ikarusim · Google', 5, 'Después de la operación de hombro de mi abuela, Spitex 24 en […]', '2024-05-29'::date),
    ('c37c7135-4866-579a-a023-e94cd6eac744'::uuid, '956e7cdf-cbe9-4264-80e0-88fa575baa29'::uuid, 'Spitex24 — Aarau', 'noe · Google', 5, 'Después de que mi padre fue dado de alta del hospital, él... […]', '2024-05-06'::date),
    ('251f65f0-54ab-56cc-af7f-a59e4fc7cc09'::uuid, '956e7cdf-cbe9-4264-80e0-88fa575baa29'::uuid, 'Spitex24 — Aarau', 'Elisabeth Guldimann · Google', 5, 'Estoy muy satisfecho con Spitex24. Buen desempeño y empleados. […]', '2024-11-15'::date),
    ('35541822-d3fb-543b-ad87-0cce57637445'::uuid, '956e7cdf-cbe9-4264-80e0-88fa575baa29'::uuid, 'Spitex24 — Aarau', 'Jean Bühler · Google', 5, 'Estamos en uso todos los días y estamos muy agradecidos por ello. […]', '2023-02-13'::date),
    ('c5e69921-87b5-58c8-a27d-62da6b49ffb5'::uuid, '956e7cdf-cbe9-4264-80e0-88fa575baa29'::uuid, 'Spitex24 — Aarau', 'Sandro · Google', 1, 'No recomendaría el Spitex 24 de ninguna manera.', '2024-01-30'::date),

    -- Spitex24 — Baden — Google: 4.6/5, 44 valoraciones.
    ('26b1df80-12e8-5143-a53b-5958cf04117b'::uuid, 'ef4a36ef-ec96-42ee-832c-e7a9f7d778e5'::uuid, 'Spitex24 — Baden', 'Anel Gazic · Google', 5, 'Los empleados me parecen muy atentos y concienzudos. Soy […]', '2024-12-10'::date),
    ('78441d5a-f3f1-555d-a550-6d84b039313a'::uuid, 'ef4a36ef-ec96-42ee-832c-e7a9f7d778e5'::uuid, 'Spitex24 — Baden', 'Soraya · Google', 5, 'El personal siempre fue muy respetuoso y amable conmigo. […]', '2024-05-06'::date),
    ('ec6ec6f1-a474-5d78-aad1-3ac3a165054a'::uuid, 'ef4a36ef-ec96-42ee-832c-e7a9f7d778e5'::uuid, 'Spitex24 — Baden', 'Janine Bredanger · Google', 4, 'Estamos muy satisfechos con Spitex24 y podemos recomendarlo a otros. […]', '2024-11-25'::date),

    -- Spitex24 — Zúrich — Google: 4.4/5, 57 valoraciones.
    ('4cef7f02-5deb-5fd9-aeac-28cd56d70a60'::uuid, 'f849bfbb-727e-4b6b-9798-6b64ceef8358'::uuid, 'Spitex24 — Zúrich', 'Z A · Google', 1, 'Nada amigable y nada flexible. necesitaba un […]', '2023-06-30'::date),
    ('3224e585-6845-5097-ae7a-fe106f68288e'::uuid, 'f849bfbb-727e-4b6b-9798-6b64ceef8358'::uuid, 'Spitex24 — Zúrich', '-B · Google', 1, 'Desgraciadamente he tenido muy malas experiencias con este despecho. […]', '2025-04-24'::date),
    ('ed7e856e-d8b4-5572-a2b5-759e7a8d74c8'::uuid, 'f849bfbb-727e-4b6b-9798-6b64ceef8358'::uuid, 'Spitex24 — Zúrich', 'sirin bakhi · Google', 5, 'El equipo de Spitex es súper amable y siempre servicial. […]', '2024-12-11'::date),

    -- SUUBER — Google: 3.8/5, 8 valoraciones.
    ('34bed58f-ae50-5479-a4df-971d48550400'::uuid, 'ae6af47e-9ba9-4e27-b4ab-06fd5733e6e4'::uuid, 'SUUBER', 'Daniela Ulli · Google', 5, 'Nunca he estado tan relajado... Gran limpiador y yo […]', '2022-08-17'::date),
    ('ad7edd9d-c395-5a50-a35f-5352d4e99ac6'::uuid, 'ae6af47e-9ba9-4e27-b4ab-06fd5733e6e4'::uuid, 'SUUBER', 'Marc Stieger · Google', 5, 'muy satisfecho con la señora de la limpieza brindada, el servicio también es […]', '2022-08-18'::date),
    ('57f4ac88-3f2a-53bc-a432-bbee30849d21'::uuid, 'ae6af47e-9ba9-4e27-b4ab-06fd5733e6e4'::uuid, 'SUUBER', 'Bicaj Edon · Google', 5, 'Estamos muy satisfechos con Suuber.ch. Todo salió bien.', '2022-07-11'::date),
    ('e96f49e3-1357-59aa-aae6-ccf8a23b4578'::uuid, 'ae6af47e-9ba9-4e27-b4ab-06fd5733e6e4'::uuid, 'SUUBER', 'Chaimae Belhadj · Google', 5, 'Excelente servicio', '2025-04-25'::date),

    -- Th. Willy AG — Google: 4.5/5, 680 valoraciones.
    ('a50c13da-a143-5fdd-a594-187d918215a3'::uuid, 'ccddd5a2-3199-42e3-afb7-1fc41ea3e4ae'::uuid, 'Th. Willy AG', 'Antonio Angelino (TonuzZ) · Google', 5, 'Buen servicio y personal amable. Raúl es un gran auto. […]', '2023-12-11'::date),
    ('ed6d858e-cd4e-5b13-a675-868765d4e676'::uuid, 'ccddd5a2-3199-42e3-afb7-1fc41ea3e4ae'::uuid, 'Th. Willy AG', 'A l (Ale) · Google', 5, '¡El personal allí es realmente increíble! Profesional, amigable, con precisión. […]', '2021-10-30'::date),

    -- TOMCO-PERSONAL AG — Google: 4.8/5, 22 valoraciones.
    ('fe85c2f7-b699-502b-a6fd-d215af2e7a4b'::uuid, 'c3b94fa9-402d-405e-b663-6a233409f6a2'::uuid, 'TOMCO-PERSONAL AG', 'José Pires · Google', 5, 'Pascal, Stefanie y Claudia fueron increíbles. Acogedor, agradable y muy […]', '2024-03-30'::date),
    ('740c9246-474a-53a2-a2ce-5c0fa997ee8d'::uuid, 'c3b94fa9-402d-405e-b663-6a233409f6a2'::uuid, 'TOMCO-PERSONAL AG', 'szczureczek .szczurek · Google', 5, 'Súper', '2024-03-22'::date),
    ('44836cf4-245e-5339-a6f3-6599c28dcc1b'::uuid, 'c3b94fa9-402d-405e-b663-6a233409f6a2'::uuid, 'TOMCO-PERSONAL AG', 'Simon Meisel · Google', 5, 'Esta fue mi primera experiencia con una agencia de contratación. […]', '2024-03-20'::date),
    ('163ef7db-c376-535d-a901-fc57d5dc25ec'::uuid, 'c3b94fa9-402d-405e-b663-6a233409f6a2'::uuid, 'TOMCO-PERSONAL AG', 'Abdurrahman Efe · Google', 5, 'Hola, quiero postularme para un trabajo aquí, pero mi nivel de idioma es A1. […]', '2023-05-11'::date),
    ('86284441-5d2f-5197-a256-79885f54e57d'::uuid, 'c3b94fa9-402d-405e-b663-6a233409f6a2'::uuid, 'TOMCO-PERSONAL AG', 'Sabrina Reyes - Dancer BRiNA - · Google', 5, 'El equipo de Tomco es súper amigable. los empleados toman […]', '2022-04-30'::date),

    -- UniTranslate — Google: 4.8/5, 79 valoraciones.
    ('c34c2cea-b90e-558c-a73d-2d410420663b'::uuid, 'b79154bd-d148-418a-8907-ac2c031a2371'::uuid, 'UniTranslate', 'Gino Barille · Google', 5, 'Las traducciones proporcionadas por UniTranslate se utilizaron para tratar […]', '2024-06-14'::date),
    ('840878af-6204-501e-aebd-14a1f82b2952'::uuid, 'b79154bd-d148-418a-8907-ac2c031a2371'::uuid, 'UniTranslate', 'Emmanuel Garuz · Google', 5, 'Tuvimos una experiencia excepcional con UniTranslate para nuestro nacimiento. […]', '2024-01-21'::date),

    -- Vazba Reinigung Transport — Google: 5.0/5, 57 valoraciones.
    ('b90324e1-ae75-5aba-af45-b2542312abd8'::uuid, '7ef129eb-3826-46ce-a86e-71706fc5a3d0'::uuid, 'Vazba Reinigung Transport', 'Mikel Alvarez Otermin · Google', 5, '¡Cristina estuvo increíble! Ella manejó mi mudanza con cuidado y […]', '2024-11-25'::date),

    -- Zahnarztpraxis Adrian Goitia — Google: 4.6/5, 32 valoraciones.
    ('c5af7acf-aabc-52ca-a4f2-cf1341fb655f'::uuid, 'e2b2fa42-6a29-4ccc-b0af-1a937f38b0f1'::uuid, 'Zahnarztpraxis Adrian Goitia', 'Fernando Orellana · Google', 5, 'Excelente trabajo del Dr. Adrián y su equipo, la atención. […]', '2024-08-28'::date),
    ('69794dcd-a8dc-5124-ad6f-cc72627f55b6'::uuid, 'e2b2fa42-6a29-4ccc-b0af-1a937f38b0f1'::uuid, 'Zahnarztpraxis Adrian Goitia', 'TM shei · Google', 5, 'El equipo sabe lo que está haciendo. son amigables […]', '2022-02-28'::date),
    ('36438195-2615-5d3d-a074-d592f37bc110'::uuid, 'e2b2fa42-6a29-4ccc-b0af-1a937f38b0f1'::uuid, 'Zahnarztpraxis Adrian Goitia', 'Sergio Palazzi · Google', 5, '¡El Dr. Goitia estaba muy bien informado, excelente ubicación y personal amable! […]', '2022-02-14'::date),
    ('31ffaf75-7978-524a-a077-51bc640911cd'::uuid, 'e2b2fa42-6a29-4ccc-b0af-1a937f38b0f1'::uuid, 'Zahnarztpraxis Adrian Goitia', 'M. Carmen Chavez · Google', 5, 'El Dr. Goitia es el dentista más atento y profesional. Muy […]', '2022-02-15'::date),
    ('60b9bd4e-6e6a-5563-acd6-3711741d0008'::uuid, 'e2b2fa42-6a29-4ccc-b0af-1a937f38b0f1'::uuid, 'Zahnarztpraxis Adrian Goitia', 'Patrik Vargas · Google', 5, 'Fantástica atención, gracias por toda la ayuda.', '2022-02-15'::date),
    ('dc658d92-a85c-5197-afe6-5eae5ec538ba'::uuid, 'e2b2fa42-6a29-4ccc-b0af-1a937f38b0f1'::uuid, 'Zahnarztpraxis Adrian Goitia', 'Alfredo Cabrales · Google', 5, 'Profesionalismo absoluto en los trabajos realizados, genera mucha confianza y […]', '2024-04-10'::date),
    ('7a7a3ce6-6d95-5c69-a851-26a8d064a6d6'::uuid, 'e2b2fa42-6a29-4ccc-b0af-1a937f38b0f1'::uuid, 'Zahnarztpraxis Adrian Goitia', 'Andreas K · Google', 5, 'Dentista muy competente y comprometido con atención al detalle. […]', '2023-06-18'::date)
)
INSERT INTO public.reviews (
  id, provider_id, user_id, author_name, canton, stars, text, verified, active, created_at
)
SELECT
  imported.id,
  imported.provider_id,
  NULL,
  imported.author_name,
  provider.canton,
  imported.stars,
  imported.review_text,
  FALSE,
  TRUE,
  imported.published_at::timestamptz + INTERVAL '12 hours'
FROM imported_reviews AS imported
JOIN public.providers AS provider
  ON provider.id = imported.provider_id
 AND provider.name = imported.expected_name
WHERE NOT EXISTS (
  SELECT 1
  FROM public.reviews AS existing
  WHERE existing.provider_id = imported.provider_id
    AND existing.active = TRUE
) OR EXISTS (
  SELECT 1
  FROM public.reviews AS existing_import
  JOIN imported_reviews AS known_import ON known_import.id = existing_import.id
  WHERE known_import.provider_id = imported.provider_id
)
ON CONFLICT (id) DO UPDATE SET
  user_id = NULL,
  author_name = EXCLUDED.author_name,
  canton = EXCLUDED.canton,
  stars = EXCLUDED.stars,
  text = EXCLUDED.text,
  verified = FALSE,
  active = TRUE,
  created_at = EXCLUDED.created_at;

COMMIT;

-- Verificación: muestra solamente las filas creadas por este archivo.
WITH imported_ids (id) AS (
  VALUES
    ('11a5fbcd-d0bb-5096-a6d7-7cb2653f8e2a'::uuid),
    ('4389364b-da5b-5b8a-a3f4-010de22e84af'::uuid),
    ('a4499f77-54ff-5b16-a0dd-abfd46fb9ed9'::uuid),
    ('d31b4dcc-0982-59a7-ad3e-40e1cbc7de23'::uuid),
    ('90d8fe18-a9c0-511a-a95c-068008a95df3'::uuid),
    ('9b66b08b-4fe4-5f7b-a91c-f604e59dc92a'::uuid),
    ('c864bd7a-7d82-5583-af9b-1280203b2218'::uuid),
    ('40549d6b-f493-5e47-a7f4-92c727c99681'::uuid),
    ('f5c380d8-4af9-5f31-ad85-314db55b1ddd'::uuid),
    ('387ff034-90bb-55fe-a878-3e5b48c8899b'::uuid),
    ('d9884948-a430-57d3-a4b7-f7887b834492'::uuid),
    ('7bcfa499-6d39-5f03-ab26-3ad10f307128'::uuid),
    ('10379127-a872-5bbd-a7de-414590de3c36'::uuid),
    ('2e7789af-f641-501a-a13d-c6e3fc377b22'::uuid),
    ('5447f737-83ef-5e8a-aab5-8303c7b72225'::uuid),
    ('2e1b6c42-34c5-5939-ac76-079f0295f390'::uuid),
    ('32d43d56-e45d-541a-ab57-ffc5a9c3c565'::uuid),
    ('b17f326a-0109-5ecc-ac78-2b8037b2f235'::uuid),
    ('f455a03d-5d1d-5b02-ac3d-73220dfb135d'::uuid),
    ('b3d78b1f-78c1-52da-a3fc-f61aaf13bf5f'::uuid),
    ('71bbf44d-0a19-5b2f-af8c-3f7c413c666d'::uuid),
    ('066abffd-35f3-5546-a66c-6c3da6bd6860'::uuid),
    ('34f447b2-f046-5d09-a303-6c74aaafbae1'::uuid),
    ('d3a35e75-3b2f-5bd9-ae65-67d164cb0ba4'::uuid),
    ('68ff6461-de1c-50db-a9dc-63b74addb839'::uuid),
    ('91a32444-1e53-563f-ac50-98b511430953'::uuid),
    ('83c62a33-e001-56c5-a26f-ec6f122700a1'::uuid),
    ('74a5b462-f703-5e3a-ab91-3605f9214fc9'::uuid),
    ('e5512ce2-ebfe-5d98-aad9-0d5aba6585b9'::uuid),
    ('b94c0d2a-7dd3-5e7e-a38b-f9b492fc085c'::uuid),
    ('08e504aa-9ef4-5622-a3e5-c0de4b58a289'::uuid),
    ('7308f1b8-c271-52af-a8a5-8128751df20d'::uuid),
    ('5c221422-374e-5aea-ad9a-b1ffcce58fb1'::uuid),
    ('455c0a3e-eb99-5e0a-a24c-e7c2eada4496'::uuid),
    ('1dd2053d-2ce7-5b23-a6ae-97611441def9'::uuid),
    ('248db8b5-d66d-59a1-a2e1-c8d2e699e8e6'::uuid),
    ('707f144f-0a7c-52ea-a20c-f42578535d90'::uuid),
    ('45f01984-b9fd-5668-a3e6-f6d48e2fe58d'::uuid),
    ('3759bae0-2077-57f6-a018-910053720370'::uuid),
    ('598769a1-a2af-5ac1-a0c2-806517d5dafa'::uuid),
    ('dc248c9f-648c-5bb9-a840-d2bab6b0e393'::uuid),
    ('8a5c0118-f682-574f-a753-19681920228f'::uuid),
    ('c0b9d603-57c5-58f2-a5c2-5e108d885298'::uuid),
    ('910aad94-8212-5ddf-ad49-c2dd0743f2f5'::uuid),
    ('f546c307-ab42-5ea6-a829-004b6485243f'::uuid),
    ('f1b8b782-6351-5946-afa3-188a1f2763a3'::uuid),
    ('b1945dc5-a144-586a-ae0e-4c9d8a45e015'::uuid),
    ('f69229d3-aa23-5d2d-a159-c7de7438939e'::uuid),
    ('73cbb231-c314-58a5-a4fd-afe22df4ca87'::uuid),
    ('d311922a-e8ff-5704-a843-28becf3ce800'::uuid),
    ('8d67579c-4647-5bf2-a257-47feca8a5357'::uuid),
    ('01344697-be67-5630-ae77-67bfa8f08e13'::uuid),
    ('77dfedec-3d72-503d-aa14-6bc2e6838348'::uuid),
    ('e78efafb-8fe3-5285-aea5-37635fea1b38'::uuid),
    ('57a00f28-53a8-5648-a30c-81437ac3c336'::uuid),
    ('081813bc-b1d6-5378-a8f1-3532aaf5215c'::uuid),
    ('d43d348a-823f-5169-a608-b75958b9482e'::uuid),
    ('ff2f0553-13d0-52a1-a282-de9405536401'::uuid),
    ('8bbd8ac8-74ae-5909-a60f-b32bf4cce1c5'::uuid),
    ('75c7dfd7-7280-5fe2-ae4e-25e3b6f9924f'::uuid),
    ('c1986f64-535c-5e1a-a36c-0cbd281cf53a'::uuid),
    ('98b5b212-174d-54d4-aea9-11e971707244'::uuid),
    ('57025cf9-d8cb-55c5-a6b3-a8b225152695'::uuid),
    ('88e5c431-934a-519d-a4d9-c23b10e6e3cd'::uuid),
    ('c1b86a2f-ca8a-5bab-a14a-8f09d19fc00e'::uuid),
    ('63deadb4-7011-5141-af4c-8e792d2c4522'::uuid),
    ('3a484662-0664-5c44-a65d-7ed7b9b2734f'::uuid),
    ('cca0a6fc-1cf3-5f25-af96-6ef0fea7ae33'::uuid),
    ('da810758-946a-5f5b-ae12-c5d954b85f50'::uuid),
    ('271e4b9e-c2bf-5feb-a6d3-dccbc646eb69'::uuid),
    ('89c25ab4-5e64-5aee-a515-08f254ba6c31'::uuid),
    ('6ffc556f-a484-5071-a692-02c7791a2588'::uuid),
    ('0cc2c2e5-27af-5438-a020-2597660a9fac'::uuid),
    ('f8e46481-bfa1-57c0-aef3-1cd9a42eb4f6'::uuid),
    ('0a94686c-6b9a-507d-a17e-9a5c6493c520'::uuid),
    ('8ad2e49d-d610-561b-a19e-58c70442b198'::uuid),
    ('c569578a-765a-50cd-a367-dc761b29c875'::uuid),
    ('409f6057-0e2a-5907-af64-d710917176d3'::uuid),
    ('2c92ed48-38f8-53c5-af0b-a03aa5d5abda'::uuid),
    ('60c492bd-0171-5f7a-a06c-dd9e4367f732'::uuid),
    ('4d05af9b-1d75-5dd6-a974-486225b9de2e'::uuid),
    ('ef3a6794-e5d1-5540-af5c-bd7717543c41'::uuid),
    ('8383425c-280d-5381-ad45-a38a79b653b3'::uuid),
    ('1e8ef9ce-8743-56ed-a424-d4223a084612'::uuid),
    ('89b3568a-1995-5762-a514-48eb362fd460'::uuid),
    ('6460ca69-27f3-58fc-aa5c-613e425386be'::uuid),
    ('7ed3068c-29fa-5c56-ac4b-adbcf5b57216'::uuid),
    ('a52c1e39-3be6-5d34-a278-b17f9b4f99e7'::uuid),
    ('34aada43-5c23-5d85-ae3c-c2a8c70d23b9'::uuid),
    ('3b1c3ed6-95e3-569d-a0f8-a3c3323e9071'::uuid),
    ('1805e29a-8105-56f1-aba5-19931faba837'::uuid),
    ('588037b5-6c6e-5848-a584-cd9efa89c990'::uuid),
    ('5313efa3-9508-5fed-a13a-a05aed479055'::uuid),
    ('ab514d5a-a5c0-526b-a835-ca1eff231f76'::uuid),
    ('e59d1b00-0b38-5428-af57-98e60efdd5fa'::uuid),
    ('fb06be62-c807-57ae-ad8b-d44b5bbd73e3'::uuid),
    ('3ae8ceae-a865-55f4-a84a-e7fc47166431'::uuid),
    ('39761b07-d033-573d-a73c-bf731df98fd3'::uuid),
    ('51f3a2fd-f694-59e6-ac0d-e78ec0cf7713'::uuid),
    ('d184965e-2439-59c2-a0fe-954f6da0ae78'::uuid),
    ('a0e49b51-e0d4-5238-a567-cfefc7344f7b'::uuid),
    ('d8bd4d32-4e1d-570e-aebe-4965739ca272'::uuid),
    ('54dcf4f6-b79b-5b0b-aa02-a77099eb9190'::uuid),
    ('70fa4514-7350-597a-aa48-d20237776edb'::uuid),
    ('e119a72d-7b39-55c6-a47d-c2f7fb20e4b7'::uuid),
    ('646fbd34-0191-5e7f-a828-3673a905f6c3'::uuid),
    ('b013f085-7738-580a-a4be-b94a6b813fe3'::uuid),
    ('c6273390-360f-5e5e-ad54-d1ca5432c46c'::uuid),
    ('b0df399b-2f8c-5e54-ab51-32e6369577e7'::uuid),
    ('40b88442-8839-5613-ac7f-c2605cff279f'::uuid),
    ('4ab8d3ac-ce96-5346-aa62-56b47251a937'::uuid),
    ('337f2a9c-7163-5d45-a3ce-509c0de2b309'::uuid),
    ('72a0a4b3-0a39-59b8-a9fc-649c507fa2ae'::uuid),
    ('179fc7a1-e7f2-56a4-a581-c68bc3627ac9'::uuid),
    ('c5739cc7-5cb3-54c7-a55f-f6868581f8c6'::uuid),
    ('b65f7544-22bd-5517-aa4c-cab65e353e9c'::uuid),
    ('77e5d16a-d602-50f1-a910-38275cab746b'::uuid),
    ('4e263a9b-aa33-55b1-a32f-1c7c26993dcc'::uuid),
    ('9e15321d-e623-524b-a138-23a3f7f4db17'::uuid),
    ('54e4b2a6-7f3f-597e-a98a-46e0ebcb8dec'::uuid),
    ('68eb07d8-8f9d-56d0-aa49-02998da3cc81'::uuid),
    ('071d52e3-cec9-5c14-a1b3-16b820a25b99'::uuid),
    ('a18d1b09-40ca-5ec6-a239-a85675bea5f9'::uuid),
    ('07f36d04-8c0e-58f0-af2a-c8403170ee24'::uuid),
    ('a8c53aca-5c81-5ce7-ac2a-3d7a71701923'::uuid),
    ('796e4751-4440-54d3-a628-b80a64c25f43'::uuid),
    ('64817b63-aa73-5cc1-a298-70a5350d6374'::uuid),
    ('ec0cd86c-d4a1-5bc5-a95b-762e5ef2ae31'::uuid),
    ('bd90337f-567b-5ba4-a6ce-116fe2edd24a'::uuid),
    ('41bb147f-01eb-5249-abaf-8f26e2114b31'::uuid),
    ('6b62cdbc-654d-5c94-aed0-7ab5298170ca'::uuid),
    ('55634fd3-f99e-5007-a91e-20ec37f1e8d8'::uuid),
    ('c34d76ed-be1e-5697-a0b0-90ffb1d0e730'::uuid),
    ('716041d1-0165-598b-ad2e-d09e941a1644'::uuid),
    ('6617908f-d18a-5829-ac03-82de2720bfe8'::uuid),
    ('d781f344-b26c-50a7-a3d1-73193c9a27da'::uuid),
    ('c0916e5a-a89a-5e2d-a531-03217df039a2'::uuid),
    ('ca14590f-5b3c-5742-a6c9-ec1f6d18e25b'::uuid),
    ('a3025bba-a68d-5362-a034-c2ce8aac2291'::uuid),
    ('3bd13374-8d6a-53a5-ab83-94fab00cccef'::uuid),
    ('dfc13b9e-448c-5a96-a198-cb3b67334d30'::uuid),
    ('6b683863-a5fe-5a6f-a950-44d5b7819ee0'::uuid),
    ('93e2cf5d-82e3-501e-a0d2-194d18f6936d'::uuid),
    ('4772a81b-b418-529b-a226-1397ea4724ba'::uuid),
    ('bc75cf1a-2cfd-58b6-a4ba-fcc793c55381'::uuid),
    ('9fe365df-5e78-5d19-a093-2d430772f3c2'::uuid),
    ('e422ac06-cbb7-5264-afd6-8ea6662954d4'::uuid),
    ('1a653b60-0950-56b9-a99f-427a63563baf'::uuid),
    ('eb630350-4fd7-5101-a995-0ca12fcd1505'::uuid),
    ('dd18f23b-b323-5762-a0d1-5b55a087dcd8'::uuid),
    ('0294f67e-5a58-5caa-ad56-0f92cb5a8362'::uuid),
    ('49e43324-c7d6-5757-a199-1193ded2c8a9'::uuid),
    ('1500764e-6949-5218-afd1-af94e8a893e0'::uuid),
    ('b2b6c214-a355-56c4-afca-f5eeadfe5a0e'::uuid),
    ('8e6c95e7-9b1b-5334-ad75-e9827ba5b915'::uuid),
    ('168aa4af-a624-56c8-a58a-b04dd7143416'::uuid),
    ('b276af06-8a6e-5e69-a799-0e669911424e'::uuid),
    ('6279b0e4-fa49-54b2-a358-10f16f0f5d1a'::uuid),
    ('5f08ee0e-927d-502a-a8cb-7f8399e74428'::uuid),
    ('763e0d95-507e-5c01-abe2-08a85ce68467'::uuid),
    ('ed755909-c3d1-5130-a947-f46dce803683'::uuid),
    ('b994bb4d-5cae-50e3-adf1-2945160be0f8'::uuid),
    ('03c83c3d-d092-5822-a0bf-c1ec68fae4c6'::uuid),
    ('3f6f2f07-e8dc-53ea-acbc-ba8bd1bab94b'::uuid),
    ('45e0234c-c175-5011-a033-3e0b18498c2c'::uuid),
    ('bb3e7731-21e8-57d5-ab5a-bc3a40f2c517'::uuid),
    ('04743c42-6f66-573f-ad72-55dc85044f6d'::uuid),
    ('6ad61c46-9878-536f-a64b-4d7fac3c7e4b'::uuid),
    ('561c5685-19b1-5152-a118-c0a2bd860e88'::uuid),
    ('e51f1353-dd5d-5a4b-ad77-eddac385e9a3'::uuid),
    ('06975060-1b66-5102-a711-64e25fe00bd6'::uuid),
    ('0d659596-8277-5cbd-ac51-6e4d0d5d72d6'::uuid),
    ('cd3b6da9-7f99-5688-ac0f-eba335859d83'::uuid),
    ('92ab867f-440b-5d2c-a7e5-4a1b73600cc9'::uuid),
    ('c8065d24-02ac-5b5c-a59e-7f0cb62b9e37'::uuid),
    ('63c8c0d0-7e58-5c56-acfa-c078a9a66c97'::uuid),
    ('84b2761c-0c08-5ddc-ac70-6afaeb998b63'::uuid),
    ('2189fa8f-7d77-5bea-a8c6-bbbab41085bf'::uuid),
    ('a25c7095-cafc-5217-ad62-a6397db40582'::uuid),
    ('bbd42762-51ff-5658-a205-cb3f6586d271'::uuid),
    ('dfe3f1f8-532e-5525-a737-ce0f1347fdf7'::uuid),
    ('73b7ba48-d402-58f4-a781-8ab7ed75644f'::uuid),
    ('9ee12efb-4d0c-5d41-a62d-66d88cc9f844'::uuid),
    ('1a4d1510-2e76-5479-abe1-a416d14145cc'::uuid),
    ('543a69fc-264b-54fc-a4fe-252323c15a2e'::uuid),
    ('7b6ec49f-ffbd-5d3e-aa41-0e7fa6db87e0'::uuid),
    ('989382b3-5961-5369-afbb-504819a1ed71'::uuid),
    ('15df3917-f93b-5994-aa65-fbd00811ae8d'::uuid),
    ('21503ed7-53da-5219-a592-8a4418660aca'::uuid),
    ('9b73ae9a-1122-578b-af97-874dd107bbd1'::uuid),
    ('903eee70-1739-5619-ab20-1fe1da8de385'::uuid),
    ('49e27020-3727-5089-a00c-ff25e1ca8117'::uuid),
    ('e17c3043-4ce2-533d-ac7b-501717427c97'::uuid),
    ('8ac40458-7886-5ac6-af29-4828c7a7e3a6'::uuid),
    ('b2cf075b-3cc4-5f67-aa24-60663ba362e1'::uuid),
    ('b63086fd-3935-59ad-aeb0-a03801b774cd'::uuid),
    ('16a3b6cc-ea21-5be6-a8b6-ee9ebd97d300'::uuid),
    ('e6a1f29e-b90d-5622-a70f-e9f171ef47f3'::uuid),
    ('3da6fd24-1de7-5eed-a409-e89ad4eebe99'::uuid),
    ('644c2bc6-7e8b-56bc-a728-2c573752e8de'::uuid),
    ('618b0889-4530-507e-a434-2db92c7f4193'::uuid),
    ('42017f92-6264-57bb-a44d-3e25db9fd34f'::uuid),
    ('997c2a2b-fcb7-57d6-a5f4-3cfa02d20a89'::uuid),
    ('553fc968-f53b-51dc-a2e5-7707ce614061'::uuid),
    ('34a2dd04-59c2-5587-a8ec-0d255c44cab2'::uuid),
    ('277add29-cb8a-5d14-a64f-b36c09913cd7'::uuid),
    ('7aa15175-e60b-527f-a698-1a7ff2fffb73'::uuid),
    ('ef81f8f5-4064-5daa-a56e-d56913ce82b4'::uuid),
    ('bae1b393-da9b-512c-a4b8-3fe089b17c7f'::uuid),
    ('ad9fc1a9-a6c0-5554-a66b-b51b3f6be4bd'::uuid),
    ('38d5ddc8-b59c-569d-a3d5-ae814649a6ea'::uuid),
    ('8e7d3cc9-fcf0-57b1-a7fe-a2a76a763eb2'::uuid),
    ('0d505ae6-cdc4-5791-aaed-444f8af54a45'::uuid),
    ('12fec419-d26f-51a6-ae54-e9436201ab26'::uuid),
    ('2ff0e63c-e3ba-5571-a102-6f388e8d5197'::uuid),
    ('7981d603-8f5f-5ea7-aa6a-36160e2cafc0'::uuid),
    ('4ea5e337-d0d9-554d-a218-bc416b9a7b1b'::uuid),
    ('e28704c0-fbc0-56c6-a43d-c54218bf4f8f'::uuid),
    ('8aafc5e4-7d5d-5220-a45c-cc377d0b9802'::uuid),
    ('7d42ef43-a977-5177-a7dd-afbcd12c5920'::uuid),
    ('3d27f228-f001-524e-a9b2-ef00ca7076c4'::uuid),
    ('44efdead-9cfe-5cb2-ad8a-494d28dafe34'::uuid),
    ('758048cd-387c-58d6-a99e-2ec0c68ad814'::uuid),
    ('f97a78ef-4353-50b5-ab85-f3e9e445fe67'::uuid),
    ('fc1c1aa7-cefe-5a00-ae48-0dbda93c5445'::uuid),
    ('3a2ebfe6-d21b-59d4-aaec-cb5bf77b1768'::uuid),
    ('21a5c9d9-50e5-5a2b-a5e7-3d626cf1ae5d'::uuid),
    ('281c0feb-3284-5b91-a413-00d6cf563f9b'::uuid),
    ('168bd096-e200-5e55-ac4e-c5ea9584715a'::uuid),
    ('2a6964ff-7ffe-5a46-aa4f-9af823ce4e4d'::uuid),
    ('27ab744d-04fb-585c-a17c-174e76d7600b'::uuid),
    ('95b47afc-cd21-5729-af18-04a40a998fed'::uuid),
    ('b3f95282-0f33-5d64-a67b-1af7ac62f76a'::uuid),
    ('6573fcac-fef5-5398-a5d8-981384e2f0f3'::uuid),
    ('47df2c91-52ae-535c-a6bf-5cfaa3a8fc61'::uuid),
    ('566b0883-25cf-528c-add1-9468dfbe58dd'::uuid),
    ('bccdaa64-9abe-59f4-a537-54680c40b9cc'::uuid),
    ('3de5f1b1-0f6f-5397-ae6b-91deeaf1d0d8'::uuid),
    ('65497932-2a79-55a2-a26e-70b8c5bbef3c'::uuid),
    ('82ba8884-1821-5847-a030-1c2c227e0697'::uuid),
    ('1ee67ba4-9844-5cbe-a43e-10b5b209e062'::uuid),
    ('de017bd2-f0a8-54d6-a8cc-e8b99bcdbabe'::uuid),
    ('0be9b27f-5d54-58e0-a50e-ffccfe785604'::uuid),
    ('15470a16-4b62-5018-a1f7-92eef052f793'::uuid),
    ('79efcd57-8d28-5dbb-ad4b-70da71f8fac7'::uuid),
    ('525bd527-580b-530a-a0c5-eaa4b1e3b64c'::uuid),
    ('8a4fc260-875a-5e43-a328-6de43f0ec008'::uuid),
    ('8686dc17-f6fd-545e-a50e-5ae02ddd4fe9'::uuid),
    ('a8250875-0e9b-504b-a153-7fe8828ce1cc'::uuid),
    ('2a3a8800-fe99-5969-a28d-c8715d61217e'::uuid),
    ('e8d1a40c-33c2-5160-ad2d-8666eab7aca3'::uuid),
    ('184f7b5e-d320-588d-a9a2-3dd139ff9191'::uuid),
    ('3428363a-c83d-5795-a1b4-3d646fd4ea72'::uuid),
    ('38a343ce-af44-54a7-a36d-b88bdc4ad882'::uuid),
    ('4b377a2f-4f92-5300-a799-24d5fd3929e4'::uuid),
    ('643e50fa-ea06-55cd-a408-a11d3f84611b'::uuid),
    ('656b8a13-71fc-52be-a9ba-0cb633f25c92'::uuid),
    ('a89ea167-4011-53ea-ae57-0cc8c552924b'::uuid),
    ('a85f5d9c-f816-5ea8-a4ce-7b9254c910b5'::uuid),
    ('61b8fcd3-bb14-5b1f-aab4-ecaa2e63c54b'::uuid),
    ('f6faabba-de17-56df-a24a-04ade62c22be'::uuid),
    ('db36230f-5bf1-5260-aecf-ca9592065040'::uuid),
    ('7a042ba1-c652-5487-a744-97c070dd67c4'::uuid),
    ('2879bf0b-bf4f-5ba4-a8ff-5aac4828a228'::uuid),
    ('67d98ffa-70a2-5308-a874-37a4d00f447f'::uuid),
    ('0224dfbd-c297-5e3f-a209-d5f348fec6a8'::uuid),
    ('e6971361-cfdb-5844-ad89-a9642bf38f67'::uuid),
    ('7200457e-ef91-5460-aeab-501f16d4ef01'::uuid),
    ('0af9bc66-e2ba-5271-a3e4-61594e67d487'::uuid),
    ('2392e229-e741-5d91-ad1c-6a9d9dfef59b'::uuid),
    ('910b0ef2-ecad-5383-aeb2-cd65010fc169'::uuid),
    ('0110dae2-7f2a-5fc4-aaae-d0ba73c7c9f8'::uuid),
    ('b7c53d47-f347-51c5-a789-785d7f9c9857'::uuid),
    ('fa34f9e9-ec9f-5273-a886-edaff3154c45'::uuid),
    ('172c9967-2dc9-55eb-a080-db15783bdd21'::uuid),
    ('d7702fce-b160-5769-a009-65a2a4a2558e'::uuid),
    ('554697e8-618b-502d-ac7a-3230a362a3ee'::uuid),
    ('07df5132-0f90-5232-a4bc-66a840e78496'::uuid),
    ('e0c6dc59-151f-5dff-ac0b-19ace659e9ab'::uuid),
    ('d05d30fb-c2f3-5128-ae9a-93cfbf4c2778'::uuid),
    ('5f7c9d8e-ce15-5526-abbc-0d5916f2154e'::uuid),
    ('84c4c968-8ee4-5f9c-a510-c3db57ebe631'::uuid),
    ('749953f4-5918-5c22-aa7a-4140e58a7699'::uuid),
    ('75f5c6d9-c74d-556a-a914-4e27dcd0aa7a'::uuid),
    ('667564e5-279e-5be2-abd3-64c0c7a9b18d'::uuid),
    ('2183da3a-91d8-5f43-af7c-c60d82b56a92'::uuid),
    ('cf6b136b-8aa3-5af5-a29f-15153f8ac821'::uuid),
    ('6d4eb613-056c-5978-a93b-4271684d793d'::uuid),
    ('58a98287-95a6-53f8-a3a0-6d7210593d9d'::uuid),
    ('cf358859-d2f9-5087-a5ad-a6b4921be5bc'::uuid),
    ('52f454d8-9499-5c97-a078-112e857fe439'::uuid),
    ('a3c2c0c2-5f42-5d69-a2e3-de9ffeb9511f'::uuid),
    ('8d08b11c-7e4b-517a-a913-409d4c947f73'::uuid),
    ('a7872438-82af-5542-af00-e814d32bce1a'::uuid),
    ('de413897-0bb3-5267-a530-a5235fccfb88'::uuid),
    ('2b4c9c11-1157-5f92-a98d-be88d713c44c'::uuid),
    ('c2a4ae00-84fe-5fad-ac07-e7655fc0f424'::uuid),
    ('06ddb84c-0372-5647-a1a9-92d1e89762c3'::uuid),
    ('d3fc45a0-efca-5915-af5b-76439b667920'::uuid),
    ('eb527949-0963-5e94-a068-b564a20d0c6b'::uuid),
    ('1d1f7f3f-39a4-54a4-a824-1b5abee9d66d'::uuid),
    ('3f169aba-16f2-5d76-a1db-ec553cd067d8'::uuid),
    ('1845dca9-13be-543e-a62c-85a782ca0fad'::uuid),
    ('3ff26037-2c6b-5899-ab61-22a892323be6'::uuid),
    ('4706c85a-e8bc-550f-ad30-59026e759dfd'::uuid),
    ('0dac816e-3807-5f6d-abf3-3047cf1233d3'::uuid),
    ('eec5d6f4-8e10-5ab5-ae84-a49535670e5b'::uuid),
    ('2d9b929c-d060-5fe3-a5f8-0681c55e0922'::uuid),
    ('bfb43b06-5691-543b-a0db-f8d6d22e188c'::uuid),
    ('a00bc385-c3f9-5542-a73f-975dd915fb08'::uuid),
    ('c8efe371-2010-5053-ae4b-3eb911a7ee8b'::uuid),
    ('c37c7135-4866-579a-a023-e94cd6eac744'::uuid),
    ('251f65f0-54ab-56cc-af7f-a59e4fc7cc09'::uuid),
    ('35541822-d3fb-543b-ad87-0cce57637445'::uuid),
    ('c5e69921-87b5-58c8-a27d-62da6b49ffb5'::uuid),
    ('26b1df80-12e8-5143-a53b-5958cf04117b'::uuid),
    ('78441d5a-f3f1-555d-a550-6d84b039313a'::uuid),
    ('ec6ec6f1-a474-5d78-aad1-3ac3a165054a'::uuid),
    ('4cef7f02-5deb-5fd9-aeac-28cd56d70a60'::uuid),
    ('3224e585-6845-5097-ae7a-fe106f68288e'::uuid),
    ('ed7e856e-d8b4-5572-a2b5-759e7a8d74c8'::uuid),
    ('34bed58f-ae50-5479-a4df-971d48550400'::uuid),
    ('ad7edd9d-c395-5a50-a35f-5352d4e99ac6'::uuid),
    ('57f4ac88-3f2a-53bc-a432-bbee30849d21'::uuid),
    ('e96f49e3-1357-59aa-aae6-ccf8a23b4578'::uuid),
    ('a50c13da-a143-5fdd-a594-187d918215a3'::uuid),
    ('ed6d858e-cd4e-5b13-a675-868765d4e676'::uuid),
    ('fe85c2f7-b699-502b-a6fd-d215af2e7a4b'::uuid),
    ('740c9246-474a-53a2-a2ce-5c0fa997ee8d'::uuid),
    ('44836cf4-245e-5339-a6f3-6599c28dcc1b'::uuid),
    ('163ef7db-c376-535d-a901-fc57d5dc25ec'::uuid),
    ('86284441-5d2f-5197-a256-79885f54e57d'::uuid),
    ('c34c2cea-b90e-558c-a73d-2d410420663b'::uuid),
    ('840878af-6204-501e-aebd-14a1f82b2952'::uuid),
    ('b90324e1-ae75-5aba-af45-b2542312abd8'::uuid),
    ('c5af7acf-aabc-52ca-a4f2-cf1341fb655f'::uuid),
    ('69794dcd-a8dc-5124-ad6f-cc72627f55b6'::uuid),
    ('36438195-2615-5d3d-a074-d592f37bc110'::uuid),
    ('31ffaf75-7978-524a-a077-51bc640911cd'::uuid),
    ('60b9bd4e-6e6a-5563-acd6-3711741d0008'::uuid),
    ('dc658d92-a85c-5197-afe6-5eae5ec538ba'::uuid),
    ('7a7a3ce6-6d95-5c69-a851-26a8d064a6d6'::uuid)
)
SELECT
  provider.name,
  ROUND(AVG(review.stars)::numeric, 1) AS imported_sample_rating,
  COUNT(*) AS imported_comments
FROM imported_ids
JOIN public.reviews AS review ON review.id = imported_ids.id
JOIN public.providers AS provider ON provider.id = review.provider_id
GROUP BY provider.id, provider.name
ORDER BY provider.name;
