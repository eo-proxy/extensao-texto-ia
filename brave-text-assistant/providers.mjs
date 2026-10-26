// Fontes e contratos conferidos em 26/10/2026. Nunca coloque chaves neste arquivo.
export const PROVIDERS = Object.freeze({
  openai: {
    name: "OpenAI (GPT)", host: "https://api.openai.com/*", baseUrl: "https://api.openai.com/v1/",
    keyLabel: "Chave da API OpenAI", keyPlaceholder: "Cole sua chave da plataforma OpenAI",
    modelPlaceholder: "ID de um modelo GPT disponível na sua conta",
    keyUrl: "https://platform.openai.com/api-keys", keyLink: "Criar chave na OpenAI",
    docsUrl: "https://developers.openai.com/api/docs/guides/text",
    steps: [
      "Abra a plataforma OpenAI e crie uma chave de API no seu projeto.",
      "Confira os créditos ou o faturamento da API e as permissões da chave para gerar texto.",
      "Salve a chave abaixo, autorize o acesso, consulte os modelos e escolha um modelo de texto."
    ],
    note: "Esta integração usa a API OpenAI. Confira acesso e cobrança na plataforma; entrar no ChatGPT não configura esta extensão.",
    modelNote: "A lista mostra candidatos de texto. Ela não confirma saldo nem compatibilidade com a geração; use Testar conexão. Chaves restritas podem exigir que você informe o ID manualmente."
  },
  gemini: {
    name: "Google Gemini", host: "https://generativelanguage.googleapis.com/*", baseUrl: "https://generativelanguage.googleapis.com/v1beta/",
    keyLabel: "Chave da Gemini API (Google AI Studio)", keyPlaceholder: "Cole a chave criada no Google AI Studio",
    modelPlaceholder: "ID Gemini; aceita também models/ seguido do ID",
    keyUrl: "https://aistudio.google.com/apikey", keyLink: "Criar chave no Google AI Studio",
    docsUrl: "https://ai.google.dev/gemini-api/docs/generate-content/api-key",
    steps: [
      "No Google AI Studio, abra API Keys e crie uma chave no projeto Google Cloud escolhido.",
      "Se seu projeto não aparecer, importe-o na área Projects do AI Studio e confira as permissões para criar chaves.",
      "Salve a chave, autorize o acesso e consulte os modelos. A lista inclui modelos Gemini compatíveis com generateContent."
    ],
    note: "Usa a Gemini Developer API do AI Studio. Não exige arquivo JSON nem configuração do Vertex AI. Cotas, disponibilidade e cobrança dependem do projeto e do modelo; chaves antigas sem restrição podem ser recusadas pelo Google.",
    modelNote: "O prefixo models/ é aceito e ajustado automaticamente. O projeto é o associado à chave; não é necessário preencher um Project ID aqui."
  },
  claude: {
    name: "Anthropic Claude", host: "https://api.anthropic.com/*", baseUrl: "https://api.anthropic.com/v1/",
    keyLabel: "Chave da Claude API", keyPlaceholder: "Cole sua chave da Claude Console",
    modelPlaceholder: "ID de um modelo Claude disponível na sua conta",
    keyUrl: "https://platform.claude.com/settings/keys", keyLink: "Criar chave na Claude Console",
    docsUrl: "https://platform.claude.com/docs/en/manage-claude/authentication",
    steps: [
      "Na Claude Console, abra API Keys e crie uma chave para o workspace que você deseja usar.",
      "Confira os créditos, limites e o acesso aos modelos nesse workspace.",
      "Salve a chave, autorize o acesso e consulte os modelos Claude. Depois teste a conexão."
    ],
    note: "Usa a Claude API direta com a Messages API. A conta do aplicativo Claude não configura a API nesta extensão. A cobrança e os limites são os da Claude Console.",
    modelNote: "Escolha um modelo retornado pela sua chave. Chaves de AWS Bedrock ou Google Vertex AI não são aceitas nesta integração."
  }
});

export function getProvider(id) {
  if (!Object.hasOwn(PROVIDERS, id)) throw new Error("Escolha OpenAI, Gemini ou Claude.");
  return PROVIDERS[id];
}

export function normalizeModel(provider, value = "") {
  getProvider(provider);
  if (typeof value !== "string") throw new Error("Informe um ID de modelo válido.");
  const model = provider === "gemini" ? value.trim().replace(/^models\//, "") : value.trim();
  if (model && !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(model)) {
    throw new Error("Informe apenas o ID do modelo, sem URL, espaços ou parâmetros.");
  }
  return model;
}

export function validateKey(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Informe a chave de API do provedor selecionado.");
  const key = value.trim();
  if (key.length > 4096 || /\s|[\x00-\x1f\x7f]/.test(key)) throw new Error("A chave contém espaços ou caracteres inválidos. Cole somente a chave.");
  return key;
}

