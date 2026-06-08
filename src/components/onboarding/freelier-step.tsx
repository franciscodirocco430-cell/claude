"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const freelierSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  kycFullName: z.string().min(2, "Full name must be at least 2 characters"),
  kycTaxId: z.string().min(4, "Tax ID must be at least 4 characters"),
});

type FreelierData = z.infer<typeof freelierSchema>;

interface FreelierStepProps {
  onComplete: (data: {
    company_name: string;
    kyc_full_name: string;
    kyc_tax_id: string;
  }) => void;
  loading?: boolean;
}

export function FreelierStep({ onComplete, loading }: FreelierStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FreelierData>({
    resolver: zodResolver(freelierSchema),
  });

  const onSubmit = (data: FreelierData) => {
    onComplete({
      company_name: data.companyName,
      kyc_full_name: data.kycFullName,
      kyc_tax_id: data.kycTaxId,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-4 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
        <Building2 className="h-5 w-5 shrink-0" />
        <p className="text-sm">
          Tell us about your company. This information helps freelancers trust your projects.
        </p>
      </div>

      <Input
        label="Company Name"
        type="text"
        placeholder="Acme Corp"
        {...register("companyName")}
        error={errors.companyName?.message}
      />

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            KYC Verification (stored securely, never shared)
          </h3>
        </div>
        <Input
          label="Full Legal Name"
          type="text"
          placeholder="Jane Smith"
          {...register("kycFullName")}
          error={errors.kycFullName?.message}
        />
        <Input
          label="Tax ID / EIN"
          type="text"
          placeholder="XX-XXXXXXX"
          {...register("kycTaxId")}
          error={errors.kycTaxId?.message}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Your tax information is encrypted and used solely for compliance purposes.
          Manual KYC review happens within 1 business day.
        </p>
      </div>

      <Button type="submit" className="w-full" loading={loading}>
        Complete Setup
      </Button>
    </form>
  );
}
