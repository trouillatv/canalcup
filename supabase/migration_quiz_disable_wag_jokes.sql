-- Retire du jeu les 13 blagues à stéréotypes sur les « femmes de footballeur »
-- (WAGs). On NE supprime PAS les lignes (les scores du Quiz #1 référencent
-- certaines via quiz_answers) : on les marque disabled=true et le tirage /
-- le mode Solo les ignorent. Réversible : disabled=false pour réactiver.
-- Les questions factuelles (arbitres femmes, mariages réels) restent actives.
--
-- Questions désactivées :
--   Pourquoi dit-on souvent que les femmes de footballeurs (WAGs) adorent le mercato d'hiver ?
--   Si un joueur oublie l'anniversaire de sa femme, quelle est la sanction immédiate selon le 
--   Si un joueur de football rate un penalty en finale, que fait sa femme pour le consoler ?
--   Quel est le point commun entre un joueur de football professionnel et son épouse après un 
--   Qu'est-ce qui est le plus difficile pour la femme d'un joueur transféré en Angleterre ?
--   Quelle est la principale différence entre une faute sifflée par un arbitre homme et une ar
--   Quel est le pire moment pour un footballeur professionnel lors d'une session shopping avec
--   Que fait la femme d'un joueur pro quand son mari lui dit qu'il part en 'mise au vert' ?
--   Que fait un joueur de football quand sa femme lui demande de passer l'aspirateur ?
--   Quel est le rôle crucial d'une WAG pendant la Coupe du Monde ?
--   Pourquoi un joueur de football a-t-il plus peur d'un regard noir de sa femme en tribune qu
--   Quel est le pire cauchemar d'une femme de joueur de football lors de la cérémonie du Ballo
--   Quel est l'accessoire indispensable de la femme d'un joueur qui vient de signer dans un cl

alter table public.quiz_questions
  add column if not exists disabled boolean not null default false;

update public.quiz_questions
  set disabled = true
  where id in (
  'e58515c3-4b2f-40e6-8ae6-ff55928d0db2',
  'e153d151-9228-424e-ba69-2550883328f6',
  'c2b15fba-ee74-47df-92fe-e307d9ca7a42',
  '6e097fa1-e2c1-4be3-b98d-263454041c30',
  'd338bad4-4c23-4e58-bd18-c4f8c105cf79',
  'ea901ee4-bd41-4c1b-a451-2151e3b7a614',
  '246cecae-768e-4d1d-afde-b12cd55c4b1f',
  'b036d40b-c405-49d0-9d14-251eb1caae80',
  'a9f00d43-9cd3-448d-af96-58d8bdbbb63b',
  '1ae75123-fdca-4201-9981-468521704013',
  'caeb2454-4397-4e5d-be80-6711339e4e2a',
  'd766f606-c7e6-43dc-a5cd-3262e81515d3',
  '826b888b-b36c-45cf-bb85-6a09f1e12bb2'
  );
