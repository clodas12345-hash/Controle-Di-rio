import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Helper function to query Gemini with retry and fallback models to prevent transient 503/429 errors
const DEFAULT_FALLBACK_MODELS = ["gemini-3.7-flash", "gemini-3.1-flash-lite"];

async function generateContentWithRetryAndFallback(
  params: any,
  primaryModel: string = "gemini-flash-latest",
  fallbackModels: string[] = DEFAULT_FALLBACK_MODELS
) {
  const modelsToTry = [primaryModel, ...fallbackModels.filter(m => m !== primaryModel)];
  
  let lastError = null;
  for (const model of modelsToTry) {
    let delay = 500;
    const maxAttempts = 1; // Uma tentativa por modelo: cai mais rápido pro próximo em caso de sobrecarga
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[Gemini API] Solicitando com modelo "${model}" (Tentativa ${attempt}/${maxAttempts})...`);
        const response = await ai.models.generateContent({
          ...params,
          model: model,
        });
        if (response) {
          console.log(`[Gemini API] Sucesso com modelo "${model}"!`);
          return response;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const status = err?.status || err?.statusCode || (errMsg.includes("503") ? 503 : (errMsg.includes("429") ? 429 : 0));
        const isTransient = status === 503 || status === 429 ||
          errMsg.includes("UNAVAILABLE") ||
          errMsg.includes("high demand") ||
          errMsg.includes("rate limit") ||
          errMsg.includes("overloaded") ||
          errMsg.includes("temporarily unavailable") ||
          errMsg.includes("RESOURCE_EXHAUSTED");
        
        console.warn(`[Gemini API] Aviso no modelo "${model}" (Tentativa ${attempt}/${maxAttempts}): ${errMsg}`);
        
        if (isTransient && attempt < maxAttempts) {
          console.log(`[Gemini API] Erro de alta demanda transitória. Aguardando ${delay}ms para tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.round(delay * 1.5);
        } else {
          // Break to try next model in fallback list
          break;
        }
      }
    }
  }
  throw lastError || new Error("Não foi possível conectar aos servidores de IA no momento devido à alta demanda. Por favor, tente novamente em instantes.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // CORS middleware for WebIntoApp / WebView APK clients
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Configure body parsers with a higher limit to handle multiple high-res base64 images
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API endpoint for receipt/earnings screenshot extraction with high-precision OCR and comprehensive text parsing
  app.post("/api/extract-receipt", async (req: any, res: any) => {
    try {
      const { imageBase64, mimeType, images, textData, text } = req.body;
      const rawText = (textData || text || "").trim();
      let imageParts: any[] = [];

      if (images && Array.isArray(images) && images.length > 0) {
        imageParts = images.map((img: { imageBase64: string; mimeType: string }) => {
          const b64 = (img.imageBase64 || "").replace(/^data:.*?;base64,/, "");
          return {
            inlineData: {
              mimeType: img.mimeType || 'image/jpeg',
              data: b64,
            },
          };
        });
      } else if (imageBase64 && mimeType) {
        const base64Data = imageBase64.replace(/^data:.*?;base64,/, "");
        imageParts = [{
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        }];
      } else if (!rawText) {
        return res.status(400).json({ error: "Parâmetros de imagem ou texto são obrigatórios." });
      }

      const textPart = {
        text: `Você é um scanner OCR e analisador financeiro/operacional especializado de altíssima precisão para motoristas de aplicativo (Uber, 99, Particular, Frotas e Veículos Elétricos/Combustão).
        Examine minuciosamente todas as imagens anexadas (fotos de comprovantes, recibos, painel do carro, prints dos apps Uber/99) juntamente com quaisquer textos colados (relatórios do WhatsApp, tabelas do Excel/Sheets, notas fiscais, cupons de postos, comprovantes de recarga, contas do mês, etc.).
        
        ${rawText ? `DADOS DE TEXTO / PLANILHA / MENSAGEM COPIADOS:\n${rawText}\n\n` : ''}
        
        DIRETRIZES COMPLETAS DE EXTRAÇÃO E RECONHECIMENTO DE DADOS:
        
        1. RECONHECIMENTO DE ENTRADAS DIÁRIAS (PRINTS, FOTOS OU TEXTO COPIADO):
           - Data: Localize a data de trabalho (ex: "25/08/2026", "25/08", "hoje", "quarta-feira 19/08", no topo da tela ou na notificação) e converta SEMPRE para o formato "YYYY-MM-DD" em 'detectedDate'. Se houver apenas dia e mês, use o ano corrente 2026. Se não houver data explícita (ex: apenas o título "Diários" da 99), retorne a data se identificada ou nula para seleção na interface.
           
           - RECONHECIMENTO DE GANHOS DO APP 99 (TELAS "SEUS GANHOS" / "CORRIDAS" / "DIÁRIOS"):
             * Se a imagem for um print ou foto do aplicativo 99 (mostrando "Seus ganhos", "Corridas", "Entregas", "Diários", "Detalhamento de ganhos", "Painel de ganhos"):
             * Classifique 'detectedType' = '99'.
             * FATURAMENTO DA 99 ('app99_earnings'): SOMA TOTAL OBRIGATÓRIA DE TODOS OS VALORES DO "Detalhamento de ganhos":
               (Valor da solicitação + Recompensa + Gorjeta + Compensação + Outro + Taxa de cancelamento + Bônus).
               Exemplo: Valor da solicitação R$ 330,71 + Recompensa R$ 26,11 + Gorjeta R$ 0,00 + Compensação R$ 0,00 + Outro R$ 0,00 = Total de R$ 356,82.
               Armazene a soma total (ex: 356.82) em 'app99_earnings'.
             * RECOMPENSA / BÔNUS 99 ('app99_bonus'): Se houver valor no campo "Recompensa" (ex: R$ 26,11), armazene também em 'app99_bonus'.
             * QUANTIDADE DE CORRIDAS 99 ('app99_rides'): No "Painel de ganhos", reconheça o campo "Solicitações" como o número de corridas/viagens realizadas (ex: "9 Solicitações" -> 'app99_rides' = 9).
             * Resumo amigável em 'documentSummary': Detalhe o faturamento 99 somado: "Faturamento 99: R$ 356,82 (Solicitação R$ 330,71 + Recompensa R$ 26,11) com 9 solicitações/corridas realizadas."

           - Ganhos e Viagens Uber: Extraia o valor líquido total recebido em 'appUber_earnings' e a quantidade de viagens em 'appUber_rides'.
           - Corridas Particulares / InDrive / Outros apps: Extraia valor em 'appParticular_earnings' e corridas em 'appParticular_rides'.
           - Outras Fontes / Ganhos extras / Entregas: Extraia em 'outrasFontes' ou 'recompensasExtra'.
           
        2. QUILOMETRAGEM & OPERAÇÃO DO VEÍCULO:
           - KM Rodado no dia: Odômetro parcial (Trip), distância percorrida no dia ou cálculo entre km final e inicial. Extraia o número em 'kmRodado'.
           - Nível de Bateria ou Tanque Restante: Se informado % de bateria restante no final do dia ou nível de combustível (ex: "sobrou 35% de bateria", "bateria: 40%"), insira o valor numérico (ex: 35) em 'sobrouBateria'.
           - Custo com Energia / Recargas Elétricas: Valores pagos em estações de recarga (Shell Recharge, Tupinambá, Volvo, Raízen, Zletric, EZVolt, etc.) ou consumo elétrico -> armazene em 'custoEnergia'.
           - Custo com Combustível: Valores pagos em postos de gasolina (gasolina, etanol/álcool, diesel, GNV) -> armazene em 'custoEnergia'.
           - Diária do Carro / Aluguel: Valor da diária de locadora (Kovi, Localiza, Unidas, Movida) ou rateio diário informado -> armazene em 'diariaCarro'.
           
        3. DESPESAS OPERACIONAIS DO VEÍCULO (DESPESAS VARIÁVEIS):
           - Lavagem: Ducha, lava-rápido, polimento, lavagem completa -> 'carExpenses_wash'.
           - Pedágios: ConectCar, Sem Parar, Veloe, praça de pedágio -> 'carExpenses_toll'.
           - Manutenção Diária / Borracharia: Remendo de pneu, calibragem, troca de óleo, troca de lâmpada, palhetas de limpador, fluidos, aditivo, alinhamento -> 'carExpenses_maintenance'.
           - Estacionamento: Rotativo, shopping, zona azul, pernoite -> 'carExpenses_parking'.
           - Outras Despesas com Veículo: Cheirinho/aromatizante, suporte de celular, cabo USB, fusíveis, flanela -> 'carExpenses_other'.
           
        4. DESPESAS COM ALIMENTAÇÃO & PEQUENOS COMÉRCIOS (REGRA EXATA DE VALOR):
           - RECONHECIMENTO DE NOMES PRÓPRIOS / MEI / DONO DA MAQUININHA / ESTABELECIMENTOS:
             * No Brasil, muitos bares, lanchonetes, restaurantes, padarias, pastelarias, marmitas, quiosques, armazéns, cafés e pequenos comércios passam cartão na maquininha registrada no NOME DO PROPRIETÁRIO ou nome comercial abreviado (ex: "siqueira", "JOSE ANTONIO NEVES UCH", "ARMAZEM SAO VITO", "UNOSSO BAR", "ALE LOJA", "KEETABR", "MP*JIMERCEARIA", "BAR DO PEIXE", "DOIS IRMAOS", "LANCHONETE DOS VIEIRAS", "PANIFICADORA PRINCESA", "SALGADEIRA SABOREAR", "BAR CAFE E LANCHES RIO", "BAR RESTAURANTE LOPES", "IFD*iFood", etc.).
             * PENSE ALÉM DO ÓBVIO: Se o lançamento for em comércio, lanchonete, bar, padaria, mercearia ou maquininha no nome do proprietário:
             * REGRA OBRIGATÓRIA DE VALOR PARA ALIMENTAÇÃO:
               - Valores ATÉ R$ 15,00 (<= 15.00) -> Classifique como CAFÉ / LANCHE ('foodExpenses_coffee' ou 'foodExpenses_snacks').
               - Valores ACIMA DE R$ 15,00 (> 15.00) -> Classifique como ALMOÇO / REFEIÇÃO ('foodExpenses_lunch').
             * Menção a "PANIFICADORA", "CONFEITARIA", "SALGADEIRA", "PADARIA", "CAFÉ", "LANCHONETE", "BAR", "RESTAURANTE", "MERCADO", "ARMAZEM", "IFOOD", "IFD*", "KEETABR", "MERCEARIA", "LOJA": aplique a mesma regra de valor (até R$ 15 = café, acima de R$ 15 = almoço).
           - NOTA: Respeite rigorosamente a divisão: até 15 café, acima de 15 almoço.

        5. RECONHECIMENTO DE CONTAS DO MÊS / DESPESAS FIXAS (EXCEL, LISTAS, MENSAGENS OU TABELAS):
           - Se o texto ou imagem contiver uma lista de contas do veículo ou despesas fixas do mês (ex: Financiamento de Carro, Seguro Auto/Cooperativa, MEI / DAS, IPVA, Licenciamento, WashPass Lavagem Ilimitada, Rastreador, Plano de Celular / Internet 5G, Contabilidade, Aluguel de Garagem, Troca de Pneus Parcelada, Seguro Terceiros, Manutenção Preventiva):
           - Extraia TODOS os itens no array 'fixedExpenses', preenchendo:
             * 'description': Nome claro e limpo da conta/despesa.
             * 'value': Valor numérico em R$ (ex: 2450.00).
             * 'month': Número do mês de 1 a 12 (ex: 8 para Agosto). Se não informado, use o mês corrente.
             * 'year': Ano numérico (ex: 2026).
             * 'installments': Parcela ou detalhe se houver (ex: '15/60', '3/5', 'Vence dia 10').
           - Preencha também 'fixedExpensesMonth', 'fixedExpensesYear' e o total somado em 'fixedExpensesTotal'.

        6. MÚLTIPLAS LINHAS / MÚLTIPLOS DIAS COPIADOS DE PLANILHAS (EXCEL/SHEETS):
           - Se o texto copiado for uma tabela com várias linhas contendo dados de vários dias (ex: colunas de Data, Uber, 99, Particular, KM, Energia, Alimentação, Despesas, Diária), crie um objeto para CADA DIA no array 'results' com a respectiva 'detectedDate'.

        7. LIMPEZA & PADRONIZAÇÃO:
           - Remova símbolos monetários (R$, $) e retorne números puros.
           - Forneça um resumo amigável e claro em 'documentSummary'.`,
      };

      const ExtractedDataSchema = {
        type: Type.OBJECT,
        properties: {
          detectedType: { type: Type.STRING, description: "Tipo detectado (ex: 'daily_log', 'fixed_expenses', 'multi_day_logs', 'uber', '99', 'charging', 'fuel', 'food', 'car_expenses', 'particular', 'diaria_carro', 'mixed')" },
          detectedDate: { type: Type.STRING, description: "Data no formato YYYY-MM-DD" },
          documentSummary: { type: Type.STRING, description: "Resumo explicativo dos dados extraídos" },
          kmRodado: { type: Type.NUMBER, description: "KM percorrido no dia" },
          custoEnergia: { type: Type.NUMBER, description: "Custo com energia elétrica ou combustível" },
          sobrouBateria: { type: Type.NUMBER, description: "Percentual restante de bateria ou combustível" },
          valorKwh: { type: Type.NUMBER, description: "Tarifa do kWh ou preço por litro se detectado" },
          capacidadeBateria: { type: Type.NUMBER, description: "Capacidade da bateria ou tamanho do tanque se detectado" },
          diariaCarro: { type: Type.NUMBER, description: "Valor diário da diária do carro ou rateio diário de despesas fixas" },
          appUber_rides: { type: Type.NUMBER, description: "Número de viagens Uber" },
          appUber_earnings: { type: Type.NUMBER, description: "Ganhos líquidos Uber" },
          appUber_bonus: { type: Type.NUMBER, description: "Bônus/promoções Uber" },
          app99_rides: { type: Type.NUMBER, description: "Número de viagens 99" },
          app99_earnings: { type: Type.NUMBER, description: "Ganhos líquidos 99" },
          app99_bonus: { type: Type.NUMBER, description: "Bônus/promoções 99" },
          appParticular_rides: { type: Type.NUMBER, description: "Número de corridas particulares" },
          appParticular_earnings: { type: Type.NUMBER, description: "Ganhos com corridas particulares" },
          carExpenses_wash: { type: Type.NUMBER, description: "Lavagem do veículo" },
          carExpenses_toll: { type: Type.NUMBER, description: "Pedágios" },
          carExpenses_maintenance: { type: Type.NUMBER, description: "Manutenção diária / Borracharia" },
          carExpenses_parking: { type: Type.NUMBER, description: "Estacionamento" },
          carExpenses_other: { type: Type.NUMBER, description: "Outras despesas operacionais" },
          foodExpenses_lunch: { type: Type.NUMBER, description: "Almoço / Refeição principal" },
          foodExpenses_dinner: { type: Type.NUMBER, description: "Jantar / Refeição noturna" },
          foodExpenses_snacks: { type: Type.NUMBER, description: "Café da manhã / Lanches" },
          foodExpenses_coffee: { type: Type.NUMBER, description: "Café da tarde / Bebidas" },
          recompensasExtra: { type: Type.NUMBER, description: "Gorjetas em dinheiro ou metas" },
          outrasFontes: { type: Type.NUMBER, description: "Outras fontes de ganhos" },
          isDayOff: { type: Type.BOOLEAN, description: "Indica se foi dia de folga" }
        }
      };

      const FixedExpenseItemSchema = {
        type: Type.OBJECT,
        properties: {
          month: { type: Type.INTEGER, description: "Mês (1 a 12)" },
          year: { type: Type.INTEGER, description: "Ano (ex: 2026)" },
          monthName: { type: Type.STRING, description: "Nome do mês (ex: 'Agosto')" },
          description: { type: Type.STRING, description: "Descrição/Nome da despesa (ex: 'Financiamento', 'Seguro', 'IPVA')" },
          value: { type: Type.NUMBER, description: "Valor numérico da despesa" },
          installments: { type: Type.STRING, description: "Parcelas ou vencimento se houver (ex: '15/60', 'Vence dia 10')" }
        },
        required: ["description", "value"]
      };

      const response = await generateContentWithRetryAndFallback({
        contents: { parts: [...imageParts, textPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              results: {
                type: Type.ARRAY,
                items: ExtractedDataSchema
              },
              fixedExpenses: {
                type: Type.ARRAY,
                items: FixedExpenseItemSchema,
                description: "Lista de despesas fixas do carro com mês, descrição e valor"
              },
              fixedExpensesMonth: {
                type: Type.INTEGER,
                description: "Mês identificado para as despesas fixas (1 a 12)"
              },
              fixedExpensesYear: {
                type: Type.INTEGER,
                description: "Ano identificado para as despesas fixas"
              },
              fixedExpensesTotal: {
                type: Type.NUMBER,
                description: "Soma total das despesas fixas do mês"
              }
            }
          }
        }
      }, "gemini-flash-latest");

      const resultText = response.text || "{}";
      const parsedData = JSON.parse(resultText);
      
      // Sanitization
      if (parsedData.results && Array.isArray(parsedData.results)) {
        parsedData.results.forEach((item: any) => {
          if (item.app99_bonus === undefined) item.app99_bonus = 0;
          if (item.appUber_bonus === undefined) item.appUber_bonus = 0;
          if (item.recompensasExtra === undefined) item.recompensasExtra = 0;
        });
      }
      
      res.json(parsedData);
    } catch (error: any) {
      console.error("Erro na extração do comprovante/texto:", error);
      res.status(500).json({ error: error.message || "Erro interno do servidor ao processar o comprovante ou texto." });
    }
  });

  // API endpoint for voice text extraction
  app.post("/api/parse-voice", async (req: any, res: any) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "O parâmetro text é obrigatório." });
      }

      const textPart = {
        text: `Você é um assistente financeiro inteligente para motoristas de aplicativos com veículos elétricos.
        Sua tarefa é analisar a transcrição de voz do motorista descrevendo sua atividade do dia e extrair as informações estruturadas.
        Exemplo de voz: "Hoje eu rodei 200 km, fiz 15 corridas na Uber dando 300 reais, 8 corridas na 99 dando 150 reais. Gastei 25 de almoço, 15 de lavagem e sobrou 25% de bateria."
        Extraia e retorne os seguintes campos conforme descritos na fala do motorista:
        - kmRodado: Quilometragem rodada (ex: 200)
        - custoEnergia: Custo com recarga elétrica / carregamento
        - sobrouBateria: Porcentagem de bateria restante (ex: 25)
        - app99_rides: Quantidade de corridas da 99
        - app99_earnings: Ganhos na 99 em Reais
        - app99_bonus: Bônus ou recompensas ganhas na 99
        - appUber_rides: Quantidade de corridas da Uber
        - appUber_earnings: Ganhos na Uber em Reais
        - appUber_bonus: Bônus ou recompensas ganhas na Uber
        - appParticular_rides: Corridas particulares realizadas
        - appParticular_earnings: Ganhos em corridas particulares
        - carExpenses_wash: Gasto com lavagem em Reais
        - carExpenses_toll: Gasto com pedágio em Reais
        - carExpenses_maintenance: Gasto com manutenção em Reais
        - carExpenses_parking: Gasto com estacionamento em Reais
        - carExpenses_other: Outras despesas com o veículo
        - foodExpenses_lunch: Gasto com almoço / refeição principal
        - foodExpenses_dinner: Gasto com jantar
        - foodExpenses_snacks: Gasto com lanches / café da manhã
        - foodExpenses_coffee: Gasto com café da tarde / bebidas
        - diariaCarro: Gasto com aluguel do carro ou depreciação
        - recompensasExtra: Outras recompensas
        - outrasFontes: Ganhos de outras fontes
        
        REGRA OBRIGATÓRIA DE VALOR PARA ALIMENTAÇÃO / COMÉRCIO:
        - Valores ATÉ R$ 15,00 (<= 15.00) -> Classifique como CAFÉ / LANCHE ('foodExpenses_coffee' ou 'foodExpenses_snacks').
        - Valores ACIMA DE R$ 15,00 (> 15.00) -> Classifique como ALMOÇO / REFEIÇÃO ('foodExpenses_lunch').

        Sua análise deve ser muito flexível com sinônimos (ex: "lavada", "ducha", "lavar" = carExpenses_wash; "pedágio" = carExpenses_toll; "comi", "comer", "almoçar", "refeição" = foodExpenses_lunch; "bateria", "restante", "sobrou de bateria" = sobrouBateria).
        Retorne apenas valores numéricos limpos.
        
        Transcrição de voz: "${text}"`,
      };

      const response = await generateContentWithRetryAndFallback({
        contents: { parts: [textPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              kmRodado: { type: Type.NUMBER },
              custoEnergia: { type: Type.NUMBER },
              sobrouBateria: { type: Type.NUMBER },
              app99_rides: { type: Type.NUMBER },
              app99_earnings: { type: Type.NUMBER },
              app99_bonus: { type: Type.NUMBER },
              appUber_rides: { type: Type.NUMBER },
              appUber_earnings: { type: Type.NUMBER },
              appUber_bonus: { type: Type.NUMBER },
              appParticular_rides: { type: Type.NUMBER },
              appParticular_earnings: { type: Type.NUMBER },
              carExpenses_wash: { type: Type.NUMBER },
              carExpenses_toll: { type: Type.NUMBER },
              carExpenses_maintenance: { type: Type.NUMBER },
              carExpenses_parking: { type: Type.NUMBER },
              carExpenses_other: { type: Type.NUMBER },
              foodExpenses_lunch: { type: Type.NUMBER },
              foodExpenses_dinner: { type: Type.NUMBER },
              foodExpenses_snacks: { type: Type.NUMBER },
              foodExpenses_coffee: { type: Type.NUMBER },
              diariaCarro: { type: Type.NUMBER },
              recompensasExtra: { type: Type.NUMBER },
              outrasFontes: { type: Type.NUMBER }
            }
          }
        }
      }, "gemini-flash-latest");

      const resultText = response.text || "{}";
      res.json(JSON.parse(resultText));
    } catch (error: any) {
      console.error("Erro no processamento de voz:", error);
      res.status(500).json({ error: error.message || "Erro interno do servidor ao processar a transcrição de voz." });
    }
  });

  // API endpoint for voice and text data search assistant
  app.post("/api/assistant-search", async (req: any, res: any) => {
    try {
      const { query, logs, selectedYear, selectedMonth } = req.body;
      if (!query) {
        return res.status(400).json({ error: "O parâmetro query é obrigatório." });
      }

      // Format logs for context to Gemini
      const logsSummary = (logs || []).map((l: any) => {
        const uberGross = (l.appUber?.earnings || 0) + (l.appUber?.bonus || 0);
        const app99Gross = (l.app99?.earnings || 0) + (l.app99?.bonus || 0);
        const particularGross = (l.appParticular?.earnings || 0);
        const totalGross = uberGross + app99Gross + particularGross + (l.recompensasExtra || 0) + (l.outrasFontes || 0);
        const foodTotal = (l.foodExpenses?.lunch || 0) + (l.foodExpenses?.dinner || 0) + (l.foodExpenses?.snacks || 0) + (l.foodExpenses?.coffee || 0);
        const carTotal = (l.carExpenses?.wash || 0) + (l.carExpenses?.toll || 0) + (l.carExpenses?.maintenance || 0) + (l.carExpenses?.parking || 0) + (l.carExpenses?.other || 0);
        const netProfit = totalGross - (l.custoEnergia || 0) - foodTotal - carTotal - (l.diariaCarro || 0);

        return {
          date: l.date,
          gross: totalGross,
          net: netProfit,
          uberRides: l.appUber?.rides || 0,
          uberGross,
          app99Rides: l.app99?.rides || 0,
          app99Gross,
          particularRides: l.appParticular?.rides || 0,
          particularGross,
          km: l.kmRodado || 0,
          energyCost: l.custoEnergia || 0,
          foodTotal,
          carExpensesTotal: carTotal,
          wash: l.carExpenses?.wash || 0,
          toll: l.carExpenses?.toll || 0,
          isDayOff: l.isDayOff || false,
          batteryLeft: l.sobrouBateria || 0,
        };
      });

      const systemPrompt = `Você é o Assistente Virtual e Localizador de Dados Financeiros e Operacionais do motorista de aplicativo.
Sua função é analisar o histórico de lançamentos do motorista e responder com máxima precisão às buscas por VOZ ou TEXTO.

Siga rigorosamente estas orientações:
1. Responda em Português do Brasil de forma clara, amigável e direta.
2. Seja exato em valores numéricos em Reais (R$), KM rodado, número de corridas e percentual de bateria.
3. Se a busca se referir a uma data específica (ex: "dia 15 de Julho" ou "15/07/2026"), informe os valores completos daquele dia e adicione a data no formato YYYY-MM-DD na lista 'matchingDates'.
4. Se for uma busca por totais ou estatísticas (ex: "quanto ganhei na Uber este mês", "quantos dias bati a meta de 500", "qual foi o maior ganho do ano", "quanto gastei com lavagem"), calcule o total com base nos registros e responda.
5. Em 'speechText', forneça um resumo curto e limpo (sem pontuações especiais ou markdown) perfeito para ser lido pela voz sintetizada do celular ou navegador.
6. Em 'matchingDates', retorne o array de datas relevantes no formato 'YYYY-MM-DD' para que a interface possa destacar essas células no calendário do motorista.

Busca do motorista: "${query}"
Ano Ativo no App: ${selectedYear} | Mês Ativo no App: ${selectedMonth}
Quantidade total de dias registrados no banco de dados: ${logsSummary.length}
Histórico completo dos registros:
${JSON.stringify(logsSummary)}`;

      const response = await generateContentWithRetryAndFallback({
        contents: { parts: [{ text: systemPrompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              textAnswer: { type: Type.STRING, description: "Resposta completa formatada em texto para exibição na tela" },
              speechText: { type: Type.STRING, description: "Resposta resumida fluida sem markdown para leitura em voz alta" },
              matchingDates: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Array com datas no formato YYYY-MM-DD encontradas"
              },
              highlightMetric: { type: Type.STRING, description: "Destaque numérico sintetizado (ex: 'R$ 1.450,00')" },
              suggestedAction: { type: Type.STRING, description: "Sugestão de ação curta para o motorista" }
            },
            required: ["textAnswer", "speechText"]
          }
        }
      }, "gemini-flash-latest");

      const resultText = response.text || "{}";
      res.json(JSON.parse(resultText));
    } catch (error: any) {
      console.error("Erro no assistente de busca:", error);
      res.status(500).json({ error: error.message || "Erro interno do servidor ao consultar o assistente de busca." });
    }
  });

  // API endpoint for manual version checking
  app.get("/api/version", (req, res) => {
    res.json({
      version: "GKD_CD_V.1.0.0",
      buildDate: "2026-08-20",
      releaseNotes: "Versão GKD_CD_V.1.0.0: Armazenamento local robusto, performance aprimorada e arquitetura otimizada para APK/PWA."
    });
  });

  // Explicit route to view and download the complaint PDF
  app.get("/relatorio_reclamacao_desempenho.pdf", (req, res) => {
    const pdfPath = path.join(process.cwd(), "public", "relatorio_reclamacao_desempenho.pdf");
    res.sendFile(pdfPath, (err) => {
      if (err) {
        console.error("Erro ao abrir pdf:", err);
        if (!res.headersSent) {
          res.status(404).send("Arquivo PDF não encontrado.");
        }
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
