# JMN — Versão para computador (funciona SEM internet)

Os dados ficam no próprio computador (pasta do usuário, arquivo `jmn-data.json`). Não usa Base44 nem Firebase.

## Gerar o instalador .exe (sem instalar nada)
1. Crie conta gratuita no github.com e um repositório novo (privado serve).
2. Envie todos os arquivos desta pasta (Add file → Upload files; inclua a pasta `.github`).
3. Aba **Actions** → "Gerar instalador Windows (.exe)" → **Run workflow**.
4. Em ~4 min, baixe o artefato **instalador-windows** → `JMN-Adocao-Offline-Setup-1.0.0.exe`.

Ou no seu Windows: instale Node.js 20 → `npm install` → `npm start` (testar) → `npm run dist`.
O ícone provisório está em `build/icon.ico`; troque pelo logo da JMN (256x256).

## Primeiro uso
1. Abra o programa → aba **Administrador** → crie a senha (não há recuperação; anote).
2. **Dados e backup → Carregar dados de exemplo** para conhecer, ou cadastre Projetos e depois Missionários.
3. Faça **backups (.json)** com frequência e guarde fora do computador.
4. Para levar os dados a outro computador: Exportar backup → Importar backup.

## O que funciona sem internet
Mapa com marcadores agrupados (clustering) e polígonos dos projetos, busca, filtros em cascata
(Projeto → Estado → Município → Líder), perfil com 4 abas, favoritos, cadastro/edição com fotos,
contador de cliques, histórico de alterações, backup/restauração.

## O que EXIGE internet (e por quê)
- **Mapa-base (ruas):** sem internet os marcadores aparecem sobre fundo liso. Para mapa 100% offline, coloque
  imagens de mapa em `<pasta de dados>/tiles/{zoom}/{x}/{y}.png` (botão "Abrir pasta de dados"). Use apenas tiles
  de fonte que permita download/uso offline (ex.: pacote próprio ou provedor contratado) — o servidor público do
  OpenStreetMap proíbe download em massa.
- **Botão "Adote":** abre o site oficial da JMN no navegador; o site precisa de internet.
- **WhatsApp:** abre o WhatsApp/wa.me.

## Diferenças em relação ao SRS (inevitáveis sem servidor)
- **Sem contas de usuário e sem multiusuário:** cada computador tem seus próprios dados e favoritos. Não há
  papéis Líder/Mantenedor separados: existe o modo usuário (consulta) e o modo Administrador (senha).
- **Sem notificações push** e sem sincronização entre computadores (use backup/importação).
- O campo "Líder" é texto livre (não é uma conta).
- Retorno ao app após o site NÃO confirma doação; WhatsApp aberto NÃO confirma envio (conforme SRS).

## Avisos
- **Windows SmartScreen:** sem certificado de assinatura aparece "Editor desconhecido" → Mais informações → Executar assim mesmo.
- Os dados ficam em arquivo local sem criptografia (fotos e telefones dos missionários). Proteja o computador/backups.
- Testes automáticos cobrem a camada de dados (`npm test`). A interface (Electron) foi escrita mas **não foi executada**
  no ambiente de criação — se o build ou a tela apresentarem erro, envie a mensagem para correção.
