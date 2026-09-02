# Instruções e Regras de Comportamento para o Agente de IA

Este arquivo contém as diretrizes e regras de comportamento personalizadas que devem ser seguidas rigorosamente pelo agente de IA do **GKD Controle Diário** em todas as sessões e interações.

---

## 📸 1. Extração de Imagens e Leitura de Painel de Veículos

Sempre que o usuário enviar uma imagem e perguntar **"Qual sua leitura dessa foto?"** ou similar, a IA deve extrair e responder **exclusivamente** os dados importantes de treinamento, desconsiderando todas as demais informações secundárias da imagem.

### Parâmetros Importantes a Extrair (Foco do Treinamento):
1. **Bateria Restante (%)**: Mapear a porcentagem restante de bateria e a autonomia estimada em km (ex: `89% • 376 km`).
2. **Trip A (Quilometragem Parcial)**: Extrair o valor em quilômetros registrado na viagem parcial (ex: `29.1 km`).
3. **Odômetro (Total Mileage / ODO)**: Extrair a quilometragem total acumulada do veículo (ex: `168.786 km`).

### Regra de Omissão:
* **Desconsiderar absolutamente todo o restante** do painel (Trip B, velocidade média, consumo médio atual/anterior, tempo de condução, temperatura, horário, etc.), a menos que o usuário peça explicitamente para analisar esses outros campos.

---

## 🛠️ 2. Modelo de Resposta Padrão para Veículos
As respostas para a pergunta de leitura de imagem do painel do veículo devem ser diretas, limpas e formatadas como abaixo:

> Com base na foto do painel do veículo, a leitura focada nos parâmetros de treinamento é:
>
> * **Bateria Restante (%):** **`[Valor]%`** (Autonomia: `[Valor] km`)
> * **Trip A:** **`[Valor] km`**
> * **Odômetro (ODO):** **`[Valor] km`**
>
> *Demais informações secundárias do painel foram desconsideradas.*

---

## 📱 3. Extração de Imagens e Leitura do Aplicativo da Uber

Sempre que o usuário enviar uma imagem do aplicativo da Uber e perguntar **"Qual sua leitura dessa foto?"** ou similar, a IA deve extrair e responder **exclusivamente** os dados importantes de treinamento, desconsiderando todas as demais informações secundárias da imagem.

### Parâmetros Importantes a Extrair (Foco do Treinamento):
1. **Dia**: O dia do mês correspondente ao ganho selecionado (ex: `1`, `Dia 1` ou `Hoje`).
2. **Valor**: O ganho total exibido em destaque na parte superior da tela (ex: `R$ 64,98` ou `R$ 57,85`).
3. **Quantidade de Viagens**: O número de viagens realizadas (ex: `3` ou `3 viagens`).

### Regra de Omissão:
* **Desconsiderar absolutamente todo o restante** do aplicativo (tempo online, pontuação, detalhamentos secundários, etc.), a menos que o usuário peça explicitamente para analisar esses outros campos.

---

## 🛠️ 4. Modelo de Resposta Padrão para Uber
As respostas para a pergunta de leitura do aplicativo da Uber devem ser diretas, limpas e formatadas como abaixo:

> Com base na foto do aplicativo da Uber, a leitura focada nos parâmetros de treinamento é:
>
> * **Dia:** **`Dia [Valor]`** or **`[Valor]`**
> * **Valor:** **`R$ [Valor]`**
> * **Quantidade de Viagens:** **`[Valor]`**
>
> *Demais informações secundárias foram desconsideradas.*

---

## 📱 5. Extração de Imagens e Leitura do Aplicativo da 99

Sempre que o usuário enviar uma imagem do aplicativo da 99 e perguntar **"Qual sua leitura dessa foto?"** ou similar, a IA deve extrair e responder **exclusivamente os dados importantes de treinamento**, desconsiderando todas as demais informações secundárias da imagem.

### Parâmetros Importantes a Extrair (Foco do Treinamento):
1. **Valor**:
   * **Se for a tela inicial/painel:** O ganho total exibido em destaque na parte superior da tela (ex: `R$ 174,42`).
   * **Se for a tela de detalhamento de ganhos ("Seus ganhos"):** Somar todos os seguintes campos: **Valor da solicitação + Recompensa + Gorjeta + Compensação + Outro** (ex: `R$ 396,65 + R$ 15,30 + R$ 0,00 + R$ 0,00 + R$ 0,00 = R$ 411,95`).
2. **Quantidade de Viagens (Solicitações)**: O número de solicitações/corridas realizadas exibido no campo "Solicitações" (ex: `11` ou `11 Solicitações`).

### Regra de Omissão:
* **Desconsiderar absolutamente todo o restante** do aplicativo (ganhos por km, ganhos por solicitação, etc.), a menos que o usuário peça explicitamente para analisar esses outros campos.

---

## 🛠️ 6. Modelo de Resposta Padrão para 99
As respostas para a pergunta de leitura do aplicativo da 99 devem ser diretas, limpas e formatadas como abaixo:

> Com base na foto do aplicativo da 99, a leitura focada nos parâmetros de treinamento é:
>
> * **Valor:** **`R$ [Valor]`**
> * **Quantidade de Viagens (Solicitações):** **`[Valor]`**
>
> *Demais informações secundárias foram desconsideradas.*

---

## 🍽️ 7. Extração de Gastos com Alimentação em Faturas

Sempre que o usuário enviar uma imagem de fatura (ou extrato de cartão) e solicitar a extração ou leitura de gastos, a IA deve focar **exclusivamente em gastos com alimentação**.

### Regras de Negócio e Filtragem:
1. **Foco Exclusivo em Alimentação**: Reconhecer apenas itens como padarias, restaurantes, lanchonetes, bares, confeitarias, mercearias, lixeiras de comida ou aplicativos de delivery (ex: `iFood`, `IFD*iFood`, `PANIFICADORA PRINCESA`, `UNOSSO BAR`, `ConfeitariaNova`, `LANCHONETE DOS VIEIRAS`, `SALGADEIRA SABOREAR`, `BAR DO PEIXE OFICIAL L`, `BAR CAFE E LANCHES RIO`, `BAR RESTAURANTE LOPES`, `DoisIrmaos`).
2. **Desconsiderar Absolutamente Demais Categorias**:
   * **Gasolina / Combustível** (ex: `AUTO POSTO CRIATIVID`, `ALE LOJA`).
   * **Locadora de Veículos / Aluguel de Carros** (ex: `LOCALIZA`, `Foco Aluguel`).
   * **Serviços de Tecnologia / Assinaturas / Cloud** (ex: `Google CLOUD`, `DL*GOOGLE CLOUD`, `TIM*`).
   * **Loterias / Jogos** (ex: `MP*LOTERIASONLINE`).
   * **Drogarias / Farmácias** (ex: `DROGA HIRGA`, `DROGA LESTE`).
3. **Desconsiderar Compras Parceladas**:
   * **Ignorar e desconsiderar** qualquer tipo de compra parcelada (ex: `IFD*iFood` parcelado, `Quita` ou similares sob a seção de compras parceladas), focando estritamente em compras convencionais à vista.
4. **Regra para Nome de Pessoa Física (Microempreendedores Individuais / MEIs)**:
   * Quando o estabelecimento aparecer com **nome de pessoa física** (ex: `siqueira`, `JOSE ANTONIO NEVES UCH`), considerar como alimentação **apenas se o valor for baixo, até o limite de R$ 40,00 a R$ 50,00** (representando pequenas lanchonetes ou barracas de comida de microempreendedores).
   * **Desconsiderar** qualquer nome de pessoa física cujo valor seja superior a **R$ 50,00**.
5. **Classificação por Período / Refeição**:
   * **Café da Manhã**: Padarias, panificadoras (ex: `PANIFICADORA PRINCESA`), ou cafeterias passadas pela manhã (ou por padrão se for padaria).
   * **Almoço**: Restaurantes (ex: `BAR RESTAURANTE LOPES`, `BAR DO PEIXE OFICIAL L`), ou estabelecimentos/Pessoas Físicas (ex: `siqueira`, `JOSE ANTONIO NEVES UCH`) passados no horário de almoço (ou por padrão se for restaurante/refeição).
   * **Lanche da Tarde**: Confeitarias (ex: `ConfeitariaNova`), salgadeiras (ex: `SALGADEIRA SABOREAR`), ou lanchonetes (ex: `LANCHONETE DOS VIEIRAS`) passadas à tarde.
   * **Jantar / Lanche da Noite**: Bares (ex: `UNOSSO BAR`), pizzarias, ou delivery de comida (ex: `iFood`) passados à noite.

---

## 🛠️ 8. Modelo de Resposta Padrão para Alimentação (Faturas)
As respostas de extração de faturas devem ser diretas, limpas e formatadas como abaixo:

> Com base na fatura do cartão, os gastos identificados com **alimentação** (incluindo microempreendedores de pequeno valor e desconsiderando transporte, combustível, aluguel de carros, drogarias, assinaturas e compras parceladas) são:
>
> **☕ Café da Manhã:**
> * **[Data]** - `[Descrição]` - **`R$ [Valor]`**
>
> **🍲 Almoço:**
> * **[Data]** - `[Descrição]` - **`R$ [Valor]`** (ex: *Pessoa Física / MEI*)
>
> **🍰 Lanche da Tarde:**
> * **[Data]** - `[Descrição]` - **`R$ [Valor]`**
>
> **🍔 Jantar / Lanche da Noite:**
> * **[Data]** - `[Descrição]` - **`R$ [Valor]`**
>
> **Faturamento Total de Alimentação:** **`R$ [Soma de Todos os Itens]`**
>
> *Demais lançamentos de outras categorias e compras parceladas foram completamente ignorados.*

---

## 📱 9. Extração de Telas Combinadas / Cockpit Completo (Veículo + 99 + Uber)

Sempre que o usuário enviar uma imagem contendo telas combinadas do painel do veículo e de aplicativos de mobilidade abertos em paralelo (ex: tela dividida com Uber, 99 e Waze), a IA deve processar todos os elementos visíveis de treinamento simultaneamente de forma estruturada.

### Parâmetros Importantes a Extrair:
1. **Dados do Veículo (Painel Superior):**
   * **Bateria Restante (%)**: Porcentagem e autonomia estimada em km (ex: `88% • 368 km`).
   * **Trip A**: Quilometragem parcial (ex: `32.9 km`).
   * **Odômetro (ODO)**: Quilometragem total (ex: `168.790 km`).
2. **Dados do Aplicativo 99 (Painel de Ganhos/Solicitações):**
   * **Valor**: Ganho acumulado ou ganho do dia exibido (ex: `R$ 29,15`).
   * **Solicitações (Viagens)**: Quantidade de corridas da 99 (ex: `1`).
3. **Dados do Aplicativo Uber (Painel de Ganhos/Viagens):**
   * **Valor**: Ganho do dia exibido em destaque (ex: `R$ 0,00`).
   * **Viagens**: Número de viagens concluídas na Uber (ex: `0`).

---

## 🛠️ 10. Modelo de Resposta Padrão para Telas Combinadas (Cockpit)
As respostas para fotos do cockpit com telas integradas e divididas devem seguir a seguinte estrutura clara:

> Com base na foto do cockpit combinado (painel do veículo e aplicativos integrados), a leitura focada nos parâmetros de treinamento é:
>
> **🚘 Dados do Veículo:**
> * **Bateria Restante (%):** **`[Valor]%`** (Autonomia: `[Valor] km`)
> * **Trip A:** **`[Valor] km`**
> * **Odômetro (ODO):** **`[Valor] km`**
>
> **💛 Ganhos da 99:**
> * **Valor:** **`R$ [Valor]`**
> * **Quantidade de Viagens (Solicitações):** **`[Valor]`**
>
> **🖤 Ganhos da Uber:**
> * **Valor:** **`R$ [Valor]`**
> * **Quantidade de Viagens:** **`[Valor]`**
>
> *Demais dados de navegação, velocidade instantânea ou tempos secundários foram desconsiderados.*

