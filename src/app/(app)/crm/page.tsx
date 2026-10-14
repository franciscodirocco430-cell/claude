import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_PIPELINE_STAGES } from "@/server/pipeline/default-stages";

export const metadata: Metadata = { title: "CRM" };

export default function CrmPage() {
  return (
    <>
      <PageHeader title="CRM" description="Pipeline de leads por etapa." />
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <ol className="flex min-w-max gap-3">
          {DEFAULT_PIPELINE_STAGES.map((stage) => (
            <li
              key={stage.key}
              className="bg-muted/40 flex w-64 shrink-0 flex-col gap-3 rounded-xl border p-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">{stage.name}</h2>
                <Badge variant="secondary">0</Badge>
              </div>
              <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-xs">
                Sin leads en esta etapa
              </p>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
