import styles from "./adherence.module.css";

export function EvidencePanel({ evidence, missingInformation, validation }: {
  evidence: { field: "description"; excerpt: string }[];
  missingInformation: string[];
  validation: "pending" | "approved" | "rejected";
}) {
  return <div className={styles.review}>
    <h3>Trechos citados pela IA</h3>
    <p>{validation === "approved" ? "Trechos encontrados na descrição analisada." : validation === "rejected" ? "Trecho não encontrado na descrição analisada." : "Verificação pendente."}</p>
    {evidence.length ? <ul>{evidence.map((item, index) => <li key={index}><q>{item.excerpt}</q><small>Campo: descrição</small></li>)}</ul> : <p>Nenhum trecho citado.</p>}
    <h3>Informações a conferir</h3>
    {missingInformation.length ? <ul>{missingInformation.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>Nenhuma lacuna informada.</p>}
  </div>;
}
