// Apresentação da conexão sem acessar ou exibir credenciais.
export function connectionPresentation(profile, permitted, diagnostic) {
  const configured = Boolean(profile?.apiKey && profile?.model && permitted);
  const current = configured && diagnostic?.revision && diagnostic.revision === profile.revision && diagnostic.model === profile.model ? diagnostic : null;
  const failed = Boolean(current && current.code !== "OK");
  const connected = Boolean(configured && (profile.verifiedAt || current?.code === "OK") && !failed);
  const seconds = current && Number.isFinite(current.durationMs) ? (Math.max(0, current.durationMs) / 1000).toFixed(1) : "—";
  return {
    configured, connected,
    label: connected ? "Conectado" : "Desconectado",
    diagnosticState: current ? failed ? "error" : "success" : "",
    diagnosticTitle: current ? failed ? "Falha na conexão" : "Conexão funcionando" : "Conexão e diagnóstico",
    diagnosticText: current
      ? failed
        ? "Não foi possível conectar" + (current.httpStatus ? " · HTTP " + current.httpStatus : "") + ". Tente novamente."
        : "Resposta recebida em " + seconds + " s."
      : "Teste o modelo para verificar a conexão."
  };
}

