# RST Ferramentas – Gestão de Afiliados

Aplicação full-stack em Node.js + EJS para gerir o programa de influencers da RST Ferramentas, com integração ao Prestashop 8.1.5.

## Funcionalidades

- Login sem password via OTP enviado por email.
- Dashboards distintos (Admin vs. Influencer).
- Gestão de influencers, códigos de desconto, marcas, regras de comissão e pagamentos.
- Configuração de SMTP e credenciais Prestashop via `.env`.
- Sincronização manual de encomendas através da API Prestashop, calculando comissões com base em regras por marca/defaut.

## Stack

- Node.js + Express 5
- MySQL (mysql2/promise)
- Views com EJS + Tailwind (CDN)
- Sessões via `express-session`
- Nodemailer para envio dos OTPs

## Como executar

1. **Instalar dependências**

   ```bash
   npm install
   ```

2. **Configurar base de dados**

   - Criar uma base de dados MySQL (ex.: `rst_affiliates`).
- Executar `database/schema.sql` (cria tabelas com prefixo `psrst_` para alinhar com o padrão do Prestashop).

3. **Variáveis de ambiente** (opcional via `.env`)

   ```
   PORT=3000
   SESSION_SECRET=alterar-esta-string
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASS=senha
   DB_NAME=rst_affiliates
   ```

4. **Arrancar servidor**

   ```bash
   npm run dev
   ```

5. **Criar utilizadores iniciais**

   - Inserir pelo menos um admin na tabela `Users` (role = `admin`).
   - O fluxo de OTP ficará ativo para qualquer utilizador existente.

## Estrutura principal

- `src/app.js` – configuração do Express, EJS Layouts e sessões.
- `src/routes/` – rotas públicas, admin e influencer.
- `src/services/` – acesso a dados, Prestashop, OTP e email.
- `views/` – Layout + páginas Tailwind responsivas.
- `database/schema.sql` – esquema MySQL completo.

## Sincronização de encomendas

`POST /admin/orders/sync` lê as ordens em estado pago/completo via webservice Prestashop e:

1. Identifica o influencer por código de desconto ou associação do cliente.
2. Atualiza/associa o cliente ao influencer mais recente.
3. Calcula comissões por produto respeitando regras específicas por marca ou regra default.
4. Regista as comissões como `pending` para posterior pagamento.

Certifique-se de definir `PRESTASHOP_API_URL` (ex.: `https://rstferramentas.com/api`) e `PRESTASHOP_API_KEY` no `.env` antes de sincronizar.

## Desenvolvimento

- `npm run dev` usa `nodemon`.
- As views utilizam apenas utilitários Tailwind (CDN), sem build step adicional.
- Ajuste/estenda os serviços dentro de `src/services` conforme novas integrações sejam necessárias.
- Para acelerar testes em `localhost`, deixe `AUTO_LOGIN_LOCAL=true` no `.env` (não usar em produção) e a sessão é iniciada automaticamente com o admin definido em `LOCAL_AUTO_LOGIN_EMAIL`.

## Deploy automatico via GitHub Actions

Ao fazer push para a branch main, o workflow .github/workflows/deploy.yml envia os ficheiros do projeto para o cPanel via FTP/FTPS. Antes de ativar o workflow, crie estes *repository secrets* no GitHub:

- CPANEL_HOST: hostname ou IP do servidor FTP/FTPS.
- CPANEL_USERNAME: utilizador com acesso a pasta /home/redsuper/rstferramentas.com/_influencers/.
- CPANEL_PASSWORD: password desse utilizador.

Caso o diretorio ou protocolo mude, ajuste os campos server-dir ou protocol dentro do workflow.
