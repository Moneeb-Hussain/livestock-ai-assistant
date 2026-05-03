import { TreatmentPlanDetailView } from "@/components/treatment-plan/TreatmentPlanDetailView";

type Props = {
  params: { caseId: string };
};

export default function TreatmentPlanCasePage({ params }: Props) {
  const caseId = decodeURIComponent(params.caseId);
  return <TreatmentPlanDetailView caseId={caseId} />;
}
