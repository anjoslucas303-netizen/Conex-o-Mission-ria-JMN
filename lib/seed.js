// Dados FICTÍCIOS apenas para demonstração. Apague-os no painel Administrador.
module.exports = {
  projetos: [
    { key: 'a', nome: 'Projeto Exemplo — Centro-Oeste', descricao: 'Dados de demonstração.', cor: '#0B5D3B',
      poligono: [[-13, -50], [-13, -46], [-17, -46], [-17, -50]] },
    { key: 'b', nome: 'Projeto Exemplo — Norte', descricao: 'Dados de demonstração.', cor: '#B45309',
      poligono: [[-1, -62], [-1, -55], [-6, -55], [-6, -62]] },
  ],
  missionarios: [
    { projeto: 'a', nome: 'Missionário Exemplo 1', nomeExibicao: 'Exemplo 1', estadoId: 'DF', municipioNome: 'Brasília', liderNome: 'Líder Exemplo A',
      latitude: -15.79, longitude: -47.88, telefoneWhatsapp: '5561999990001', linkAdocao: 'https://example.com/adote/1', testemunho: 'Testemunho de exemplo.\n\nSubstitua por dados reais.' },
    { projeto: 'a', nome: 'Missionário Exemplo 2', nomeExibicao: 'Exemplo 2', estadoId: 'GO', municipioNome: 'Goiânia', liderNome: 'Líder Exemplo A',
      latitude: -16.68, longitude: -49.25, telefoneWhatsapp: '5562999990002', linkAdocao: 'https://example.com/adote/2', testemunho: 'Testemunho de exemplo.' },
    { projeto: 'a', nome: 'Missionário Exemplo 3', nomeExibicao: 'Exemplo 3', estadoId: 'GO', municipioNome: 'Anápolis', liderNome: 'Líder Exemplo B',
      latitude: -16.33, longitude: -48.95, telefoneWhatsapp: '5562999990003', linkAdocao: 'https://example.com/adote/3', testemunho: 'Testemunho de exemplo.' },
    { projeto: 'b', nome: 'Missionário Exemplo 4', nomeExibicao: 'Exemplo 4', estadoId: 'AM', municipioNome: 'Manaus', liderNome: 'Líder Exemplo C',
      latitude: -3.12, longitude: -60.02, telefoneWhatsapp: '5592999990004', linkAdocao: 'https://example.com/adote/4', testemunho: 'Testemunho de exemplo.' },
    { projeto: 'b', nome: 'Missionário Exemplo 5', nomeExibicao: 'Exemplo 5', estadoId: 'AM', municipioNome: 'Parintins', liderNome: 'Líder Exemplo C',
      latitude: -2.63, longitude: -56.74, telefoneWhatsapp: '5592999990005', linkAdocao: 'https://example.com/adote/5', testemunho: 'Testemunho de exemplo.' },
  ],
};
