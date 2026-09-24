import PageHeader from "../../components/common/PageHeader";
import OvertimeHistoryTable from "../../components/overtime/OvertimeHistoryTable";

export default function OvertimePage() {
  return (
    <>
      <PageHeader
        title="Overtime"
        description="Overtime is calculated automatically when you clock out, then reviewed by a manager."
      />
      <section className="flex flex-col gap-3">
        <h2 className="text-section-heading text-ink">My overtime</h2>
        <OvertimeHistoryTable />
      </section>
    </>
  );
}
