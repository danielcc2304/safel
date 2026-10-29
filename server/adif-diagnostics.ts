// Only controlled messages/codes are exposed; never upstream HTML, stack traces or arbitrary error text.
export function adifFailure(error: unknown, stage: "download" | "parse") {
  if (stage === "parse")
    return "El HTML recibido de Adif no contiene un boletín reconocible o contiene avisos incompletos.";
  const failure = error as {
    message?: string;
    name?: string;
    cause?: { code?: string };
  } | null;
  const http = /^HTTP (\d{3})$/.exec(failure?.message || "");
  if (http)
    return `Adif ha respondido con HTTP ${http[1]} a la consulta del servidor de Safel.`;
  if (failure?.name === "TimeoutError" || failure?.name === "AbortError")
    return "La descarga de Adif ha superado el tiempo máximo de espera (9 segundos).";
  const code = failure?.cause?.code;
  if (
    code &&
    /^(?:ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT|CERT_HAS_EXPIRED|UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT_LOCALLY|DEPTH_ZERO_SELF_SIGNED_CERT|ERR_TLS_CERT_ALTNAME_INVALID)$/.test(
      code,
    )
  )
    return `Error de conexión del servidor de Safel con Adif (${code}).`;
  return "No se ha podido descargar la página de Adif desde el servidor de Safel.";
}
