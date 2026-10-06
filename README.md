# JMN — Adoção Missionária

Aplicativo desktop desenvolvido como projeto pessoal de tecnologia para organizar informações de missionários, projetos e dados geográficos.

O projeto foi desenvolvido como parte do meu aprendizado prático durante o curso de Análise e Desenvolvimento de Sistemas.

## Sobre o Projeto

O JMN — Adoção Missionária é um aplicativo desktop para Windows desenvolvido com o objetivo de centralizar e organizar informações relacionadas a missionários e projetos.

A aplicação reúne gerenciamento de dados, visualização geográfica e recursos administrativos em uma interface desktop com suporte a funcionamento offline.

## Principais Funcionalidades

- Cadastro e gerenciamento de missionários
- Cadastro e gerenciamento de projetos missionários
- Informações geográficas e coordenadas
- Mapa interativo
- Recursos de mapas offline
- Controle de acesso administrativo
- Sistema de favoritos
- Registro de eventos
- Registros de auditoria
- Backup e restauração de dados
- Importação e exportação de dados em JSON
- Gerenciamento de imagens e galerias
- Validação de dados

## Tecnologias Utilizadas

- JavaScript
- Electron
- Node.js
- HTML
- CSS
- Leaflet
- Leaflet MarkerCluster

## Arquitetura Técnica

A aplicação utiliza a arquitetura do Electron, separando as responsabilidades entre os processos principal, renderer e a camada preload.

A comunicação entre os processos da aplicação é realizada por meio de IPC.

A camada preload disponibiliza uma API controlada para o renderer utilizando o `contextBridge` do Electron.

Os dados da aplicação são armazenados localmente e gerenciados pela camada de dados do sistema.

O projeto também possui suporte a recursos de mapas offline, permitindo o acesso às informações geográficas sem depender totalmente de um serviço de mapas online.

## Autenticação e Gerenciamento de Dados

A área administrativa possui recursos como:

- Autenticação por senha
- Proteção contra tentativas de acesso malsucedidas
- Controle de tempo de sessão administrativa
- Validação de dados
- Registros de auditoria
- Backup e restauração
- Importação e exportação de dados em JSON

Esses recursos fazem parte da arquitetura local da aplicação e foram implementados como parte das práticas de desenvolvimento e organização do projeto.

## Minha Participação

Este é um projeto pessoal desenvolvido como parte do meu aprendizado prático durante o curso de Análise e Desenvolvimento de Sistemas.

Participei do desenvolvimento de:

- Estrutura da aplicação
- Implementação das funcionalidades
- Gerenciamento de dados
- Interface do usuário
- Funcionalidades administrativas
- Integração do mapa
- Testes
- Correção de erros e depuração
- Configuração da aplicação para Windows

## Dados de Demonstração

A aplicação utiliza dados fictícios para fins de demonstração, testes e apresentação.

Nenhum dado pessoal real de missionários é destinado a ser exposto neste repositório.

## Status do Projeto

Projeto pessoal em desenvolvimento contínuo, com melhorias e novas funcionalidades sendo implementadas.

## Capturas de Tela

### Mapa e Perfil do Missionário

Interface do mapa interativo com pesquisa, filtros e informações do perfil do missionário.

![Mapa e perfil do missionário](map-interface.png)

### Painel Administrativo

Interface administrativa para gerenciamento dos registros de missionários.

![Painel administrativo](admin-panel.png)

### Visão Geográfica

Visualização geográfica dos locais de atuação dos missionários e áreas dos projetos.

![Visão geográfica](map-overview.png)

## Autor

**Lucas dos Anjos**

Estudante de Análise e Desenvolvimento de Sistemas em busca da primeira oportunidade profissional na área de Tecnologia da Informação.

Tenho interesse em:

- Suporte de TI
- Suporte Técnico
- Atendimento ao Cliente
- Sistemas e Tecnologia
- Oportunidades de nível Júnior
