import { gerarRelatorioFaturamentoAdminPDF } from '../src/utils/gerarRelatorioFaturamentoAdminPDF.js';

const mockFaturas = [
  {
    id: 'fat-1',
    codigo: 'FAT-2HJAYLBI',
    empresaNome: 'Thiago Donizetti Domingos Vitoriano',
    email: 'thidovi12@gmail.com',
    telefone: '(11) 98888-7777',
    dataFormatada: '18/09/2026',
    horaFormatada: '15:02',
    acao: 'ASSINATURA APROVADA (PIX)',
    detalhes: 'Pagamento de R$ 49,90 aprovado via PIX para o plano: "Básico" (Transação MP: 178718551207).',
    metodo: 'PIX',
    valor: 49.90,
    status: 'concluido'
  },
  {
    id: 'fat-2',
    codigo: 'FAT-NDOTXUML',
    empresaNome: 'Camila Vichinhsk',
    email: 'camila.vichinhsk@gmail.com',
    dataFormatada: '13/09/2026',
    horaFormatada: '16:24',
    acao: 'ERRO NA GERAÇÃO',
    detalhes: 'Falha ao tentar processar pagamento de R$ 49,90 via cartão de crédito.',
    metodo: 'Cartão de Crédito',
    valor: 49.90,
    status: 'falha'
  },
  {
    id: 'fat-3',
    codigo: 'FAT-OHCAR8BV',
    empresaNome: 'Teste celebre',
    email: 'testecelebre@hotmail.com',
    dataFormatada: '21/08/2026',
    horaFormatada: '10:00',
    acao: 'LIBERAÇÃO VIP (SUPER ADMIN)',
    detalhes: 'Assinatura de Premium concedida pelo Super Admin como Licença Especial.',
    metodo: 'Cortesia VIP (Admin)',
    valor: 0.00,
    status: 'cortesia'
  }
];

const mockClientes = [
  {
    uid: 'u1',
    nomeExibicao: 'Thiago Vitoriano',
    assinaturaAtiva: true,
    statusAssinatura: 'ativa',
    planoId: 'plano_basico',
    rawUserData: { valorAssinatura: 49.90 }
  },
  {
    uid: 'u2',
    nomeExibicao: 'Camila',
    assinaturaAtiva: true,
    statusAssinatura: 'ativa',
    planoId: 'plano_premium',
    rawUserData: { valorAssinatura: 99.90 }
  },
  {
    uid: 'u3',
    nomeExibicao: 'Teste',
    assinaturaAtiva: true,
    statusAssinatura: 'ativa',
    planoId: 'plano_plus',
    rawUserData: { valorAssinatura: 159.90 }
  }
];

console.log('Testando gerador do Relatório Mensal PDF...');
try {
  // Chamada de teste sem modo download direto do navegador (apenas para verificar se o jsPDF compõe sem erro)
  gerarRelatorioFaturamentoAdminPDF({
    faturas: mockFaturas,
    clientes: mockClientes,
    periodoRotulo: 'SETEMBRO / 2026',
    mesNome: 'Setembro',
    ano: 2026,
    somenteQuitadas: false,
    modo: 'test'
  });
  console.log('✅ Relatório PDF montado com 100% de sucesso no jsPDF!');
} catch (e) {
  console.error('❌ Erro no teste do PDF:', e);
}
