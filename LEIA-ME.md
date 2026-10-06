# Portal 7°BPM/M — Fase 1

Site estático (GitHub Pages) + banco de dados gratuito no Supabase (contas, aprovação e permissões).

## Instalação (uma vez só)
1. Crie uma conta em https://supabase.com e um **New project** (guarde a senha do banco).
2. Menu **SQL Editor → New query**: cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Menu **Authentication → Providers → Email**: **desative "Confirm email"** (o login é por usuário, nenhum e-mail é enviado).
4. Menu **Project Settings → API**: copie a **Project URL** e a chave **anon public** para o arquivo `config.js`.
5. Em **Authentication → URL Configuration**, coloque o endereço do seu GitHub Pages em **Site URL**.
6. Suba todos os arquivos para o repositório do GitHub Pages (mantenha as pastas `img/` e `supabase/`).

## Sua conta de Admin Geral
Antes de divulgar o site, abra-o e use **Criar conta** com **usuário `sabbatino`**, o seu Nome e Sobrenome e a senha que quiser.
Essa conta nasce automaticamente aprovada como **Admin Geral** (isso só vale para a primeira conta com esse usuário).
Nenhuma outra pessoa deve criar conta antes de você.

## Cargos
- **Admin Geral**: tudo, inclusive definir cargos (editar conta → Cargo no site).
- **Admin Sargenteante**: aprova, reprova, veta e edita contas.
- **Admin de Relatórios**: será usado na página de RSO (fases seguintes).

## Fases
1. (esta) Login/cadastro com aprovação, perfil, painel de contas, página Início
2. Sobre o Batalhão + Galeria (curtidas e comentários)
3. Relatório de Serviço (RSO), Dashboard e RSO no perfil
4. Gerar BOPM + códigos (Penal, Processo Penal e CTB)
