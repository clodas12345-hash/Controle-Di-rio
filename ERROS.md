# Lista de Erros do Assistente

1. **Placeholder de Bateria**: No pedido "Qro assi", o assistente afirmou ter adicionado o placeholder "Ex: 20" no campo de bateria, mas inicialmente apenas alterou o estilo visual (CSS) sem incluir o atributo `placeholder` no HTML. O erro foi corrigido em seguida, mas a confirmação inicial foi imprecisa.
2. **Quilometragem (KM) com Decimais**: Apesar do pedido para remover decimais do "KM Atual", algumas partes do sistema ainda podiam permitir a entrada de pontos ou vírgulas em campos relacionados a quilometragem.
3. **Loops Repetitivos de Comandos**: O assistente foi sinalizado por entrar em ciclos de comandos sem foco, repetindo ações sem progresso real.
4. **Cegueira Visual e Erros Grosseiros**: Falhas na percepção de mudanças entre telas ou na aplicação exata de estilos solicitados (conforme apontado no relatório técnico de desempenho do projeto).
5. **Execução de Ações Não Solicitadas**: Alteração ou remoção de elementos sem autorização explícita do usuário (como remover/alterar o selo de diária do carro sem pedido).
6. **Incompatibilidade de Ano no Modal de Veículo**: O campo de ano no modal de "Dados do Veículo & Rateio" exibia incorretamente "2024" fixo em vez de refletir ou permitir o gerenciamento correto do ano selecionado.

