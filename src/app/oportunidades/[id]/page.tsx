import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/server/store";
import { parseRouteId } from "@/lib/domain";
import { createAdherenceService } from "@/lib/server/adherence";
import { AdherencePanel } from "@/components/adherence/panel";
import { EvidencePanel } from "@/components/adherence/evidence-panel";
import { Icon } from "@/components/icon";
import { Provenance } from "@/components/opportunities";
import { NoteForm, SaveButton } from "@/components/forms";
import { collectionDate, money, sourceDate } from "@/lib/format";

export const metadata = { title: "Detalhes da oportunidade" };
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseRouteId((await params).id);
  if (!id) notFound();
  const item = getStore().getOpportunity(id);
  if (!item) notFound();
  const adherence = createAdherenceService();
  const analysisView = adherence.getView(id);
  const analysis = analysisView.analysisId ? adherence.repository.get(analysisView.analysisId) : null;
  const fields = [
    ["Órgão / entidade", item.agency ?? "Não informado"],
    ["Município / UF", `${item.city ?? "Município não informado"} / ${item.uf ?? "UF não informada"}`],
    ["Modalidade", item.modality ?? "Não informado"],
    ["Situação informada pelo PNCP", item.sourceStatus ?? "Não informado"],
    ["Data de publicação", sourceDate(item.publishedAt)],
    ["Valor total estimado", money(item.estimatedValue)],
  ];
  return <><Link href="/oportunidades" className="back-link"><Icon name="back" size={16}/>Voltar às oportunidades</Link><div className="detail-heading"><div className="detail-badges"><span className="badge badge-neutral">{item.modality ?? "Modalidade não informada"}</span><Provenance item={item}/></div><h1>{item.description ?? "Descrição não informada"}</h1><div className="detail-id"><Icon name="file" size={15}/>Número PNCP: <span>{item.id}</span></div></div><div className="content-with-aside"><div className="detail-main"><section className="panel detail-section"><div className="section-title"><Icon name="building"/><h2>Informações da contratação</h2></div><dl className="detail-fields">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{item.estimatedValue === 0 ? <p className="field-help">Zero informado pela fonte. No PNCP, esse valor também pode representar orçamento sigiloso; confira os documentos oficiais.</p> : null}</section><section className="panel detail-section"><div className="section-title"><Icon name="clock"/><h2>Recebimento de propostas</h2></div><dl className="detail-fields"><div><dt>Início informado</dt><dd>{sourceDate(item.proposalsStartAt, true)}</dd></div><div><dt>Fim informado</dt><dd>{sourceDate(item.proposalsEndAt, true)}</dd></div></dl><div className="dataset-notice detail-notice"><Icon name="info" size={16}/><p>Horários de Brasília, conforme a fonte. Estas datas não confirmam que a contratação esteja aberta agora. Verifique atualizações e documentos no PNCP.</p></div></section><section className="panel detail-section"><div className="section-title"><Icon name="file"/><h2>Descrição original</h2></div><p className="original-description">{item.description ?? "Não informado pela fonte."}</p><h3 className="additional-heading">Informações complementares</h3><p className="original-description muted">{item.additionalInformation ?? "Não informado pela fonte."}</p></section>{item.saved ? <section className="panel detail-section"><NoteForm id={item.id} note={item.note}/></section> : null}</div><aside className="help-column"><section className="panel action-card"><h2>Organize sua revisão</h2><p>Salve esta oportunidade e registre os pontos que precisa conferir.</p><SaveButton id={item.id} saved={item.saved} full/><a href={item.officialUrl} target="_blank" rel="noopener noreferrer" className="button button-secondary">Abrir no PNCP<Icon name="external" size={16}/></a></section><AdherencePanel opportunityId={id} view={analysisView}>{analysis?.result ? <EvidencePanel evidence={analysis.result.evidence} missingInformation={analysis.result.missingInformation} validation={analysis.validation.status}/> : null}</AdherencePanel><section className="panel traceability"><h2>Origem e rastreabilidade</h2><dl><dt>Fonte</dt><dd>Portal Nacional de Contratações Públicas</dd><dt>Coleta deste registro</dt><dd>{collectionDate(item.collectedAt)} (Brasília)</dd><dt>Primeira coleta</dt><dd>{collectionDate(item.firstCollectedAt)} (Brasília)</dd><dt>Referência do conteúdo (SHA-256)</dt><dd><code>{item.recordHash}</code></dd></dl><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-link">Consulta utilizada<Icon name="external" size={13}/></a><a href={`/api/oportunidades/${encodeURIComponent(item.id)}/original`} target="_blank" rel="noopener noreferrer" className="text-link">Registro original coletado<Icon name="external" size={13}/></a></section></aside></div><div className="page-footnote"><Icon name="shield" size={15}/><p>O LicitAI auxilia a triagem comercial. Não determina habilitação jurídica, não garante elegibilidade e não envia propostas.</p></div></>;
}
