export const metadata = { title: "Termo de autorização — Inglês com IA" };

/**
 * Modelo de termo para os responsáveis (imprimir: Cmd/Ctrl+P).
 * IMPORTANTE: modelo de partida — a escola deve revisar com sua assessoria jurídica.
 */
export default function TermoPage() {
  const linha = { borderBottom: "1px solid #999", display: "inline-block", minWidth: 260 } as const;
  return (
    <article style={{ background: "#FFF", padding: "32px 28px", borderRadius: 12, lineHeight: 1.55, maxWidth: 760, margin: "0 auto" }}>
      <p className="no-print" style={{ background: "#FFF4D6", padding: 10, borderRadius: 8, fontSize: 14 }}>
        Modelo de partida. Revise com a assessoria jurídica da escola antes de usar. Para imprimir: Cmd+P (Mac) ou Ctrl+P.
      </p>
      <h1 style={{ fontSize: 20, textAlign: "center" }}>
        Termo de autorização do responsável
        <br />
        Uso do aplicativo “Inglês com IA”
      </h1>
      <p>
        Escola: <span style={linha} />
      </p>
      <p>
        Eu, <span style={linha} />, responsável legal pelo(a) aluno(a) <span style={linha} />, da turma{" "}
        <span style={{ ...linha, minWidth: 120 }} />, declaro que fui informado(a) e autorizo o uso do aplicativo de prática de
        inglês com inteligência artificial oferecido pela escola, nas condições abaixo:
      </p>
      <ol>
        <li>
          <strong>Para que serve:</strong> o aluno conversa em inglês com um tutor virtual, por texto ou voz, para praticar o
          idioma. A escola acompanha o progresso (pontos, missões, tempo de prática).
        </li>
        <li>
          <strong>Dados tratados:</strong> nome, turma, e-mail/login escolar, as mensagens da conversa e dados de uso. A voz do
          aluno é convertida em texto pelo serviço de reconhecimento de voz do navegador (por exemplo, Google no Chrome ou
          Apple no Safari); o aplicativo não grava nem guarda o áudio da voz do aluno. Quem preferir pode usar só o texto.
        </li>
        <li>
          <strong>Proteções:</strong> o sistema remove dados pessoais (como telefone e e-mail) antes de enviar o texto ao
          serviço de inteligência artificial, bloqueia conteúdos impróprios e limita o tempo diário de uso. Os dados não são
          vendidos nem usados para publicidade.
        </li>
        <li>
          <strong>Serviços utilizados:</strong> provedores de inteligência artificial (conversa) e de síntese de voz (fala
          do tutor) contratados pela escola, que processam o texto apenas para gerar as respostas, e o serviço de
          reconhecimento de voz do navegador, quando o aluno usa o microfone.
        </li>
        <li>
          <strong>Direitos:</strong> o responsável pode, a qualquer momento, pedir acesso, correção ou exclusão dos dados, ou
          retirar esta autorização, falando com a coordenação da escola.
        </li>
      </ol>
      <p style={{ marginTop: 32 }}>
        Local e data: <span style={linha} />
      </p>
      <p style={{ marginTop: 40 }}>
        <span style={{ ...linha, minWidth: 360 }} />
        <br />
        Assinatura do responsável · CPF: <span style={{ ...linha, minWidth: 160 }} />
      </p>
      <style>{"@media print { header, .no-print { display: none !important } body { background: #FFF !important } }"}</style>
    </article>
  );
}
