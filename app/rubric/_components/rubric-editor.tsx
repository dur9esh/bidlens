"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { DEFAULT_RUBRIC_CONTENT } from "@/lib/rubric/defaults";
import type {
  Category,
  HardRequirement,
  Rubric,
  RubricContent,
} from "@/lib/rubric/types";

const TOTAL_TARGET = 100;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function sum(values: number[]) {
  return values.reduce((acc, v) => acc + v, 0);
}

function setCategoryWeight(
  content: RubricContent,
  categoryId: string,
  weight: number
): RubricContent {
  return {
    ...content,
    categories: content.categories.map((c) =>
      c.id === categoryId ? { ...c, weight } : c
    ),
  };
}

function setCriterionWeight(
  content: RubricContent,
  categoryId: string,
  criterionId: string,
  weight: number
): RubricContent {
  return {
    ...content,
    categories: content.categories.map((c) =>
      c.id === categoryId
        ? {
            ...c,
            criteria: c.criteria.map((cr) =>
              cr.id === criterionId ? { ...cr, weight } : cr
            ),
          }
        : c
    ),
  };
}

function toggleHardRequirement(
  content: RubricContent,
  requirementId: string,
  enabled: boolean
): RubricContent {
  return {
    ...content,
    hardRequirements: content.hardRequirements.map((h) =>
      h.id === requirementId ? { ...h, enabled } : h
    ),
  };
}

export function RubricEditor({ initialRubric }: { initialRubric: Rubric }) {
  const [rubric, setRubric] = useState<Rubric>(initialRubric);
  const [savedContent, setSavedContent] = useState<RubricContent>(
    initialRubric.content
  );
  const [saving, setSaving] = useState(false);

  const isDirty = useMemo(
    () => JSON.stringify(rubric.content) !== JSON.stringify(savedContent),
    [rubric.content, savedContent]
  );

  const categoriesTotal = useMemo(
    () => sum(rubric.content.categories.map((c) => c.weight)),
    [rubric.content.categories]
  );

  const criteriaCount = useMemo(
    () => sum(rubric.content.categories.map((c) => c.criteria.length)),
    [rubric.content.categories]
  );

  const enforcedCount = useMemo(
    () => rubric.content.hardRequirements.filter((h) => h.enabled).length,
    [rubric.content.hardRequirements]
  );

  async function persist(content: RubricContent, successMessage: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/rubric", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rubric.id, content }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const updated = (await res.json()) as Rubric;
      setRubric(updated);
      setSavedContent(updated.content);
      toast.success(successMessage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    await persist(rubric.content, "Rubric saved");
  }

  async function handleReset() {
    setRubric((r) => ({ ...r, content: DEFAULT_RUBRIC_CONTENT }));
    await persist(DEFAULT_RUBRIC_CONTENT, "Rubric reset to defaults");
  }

  return (
    <div className="flex-1">
      <main className="max-w-4xl mx-auto px-6 py-16 space-y-10">
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="size-4" />
            BidLens
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Rubric
          </h1>
          <p className="text-slate-600">
            Configure how BidLens evaluates vendor bids against the RFP.
          </p>
        </div>

        <Card className="shadow-sm border-slate-200/80">
          <CardContent className="pt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1 min-w-0">
              <p className="font-medium text-slate-900">{rubric.name}</p>
              <p className="text-sm text-slate-500">
                {rubric.content.categories.length} categories ·{" "}
                {criteriaCount} criteria ·{" "}
                {rubric.content.hardRequirements.length} hard requirements
              </p>
              <p className="text-xs text-slate-400">
                Last updated {new Date(rubric.updatedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={saving}
              >
                <RotateCcw className="size-4" />
                Reset to defaults
              </Button>
              <Button
                onClick={handleSave}
                disabled={!isDirty || saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-200 disabled:text-slate-500"
              >
                <Save className="size-4" />
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <ValidationRow
          categoriesTotal={categoriesTotal}
          categories={rubric.content.categories}
        />

        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
            Categories
          </h2>
          <div className="space-y-4">
            {rubric.content.categories.map((cat) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                onCategoryWeightChange={(weight) =>
                  setRubric((r) => ({
                    ...r,
                    content: setCategoryWeight(r.content, cat.id, weight),
                  }))
                }
                onCriterionWeightChange={(criterionId, weight) =>
                  setRubric((r) => ({
                    ...r,
                    content: setCriterionWeight(
                      r.content,
                      cat.id,
                      criterionId,
                      weight
                    ),
                  }))
                }
              />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
            Hard requirements
          </h2>
          <Card className="shadow-sm border-slate-200/80">
            <CardHeader>
              <div className="flex items-baseline justify-between gap-3">
                <CardTitle className="text-slate-900 text-lg">
                  Pass / fail checks
                </CardTitle>
                <span className="text-xs text-slate-500">
                  {enforcedCount} of {rubric.content.hardRequirements.length}{" "}
                  enforced
                </span>
              </div>
              <p className="text-sm text-slate-500">
                A bid that fails any enabled hard requirement is disqualified
                before scoring.
              </p>
            </CardHeader>
            <CardContent className="space-y-1">
              {rubric.content.hardRequirements.map((hr, idx) => (
                <div key={hr.id}>
                  {idx > 0 && <Separator className="my-3" />}
                  <HardRequirementRow
                    requirement={hr}
                    onToggle={(enabled) =>
                      setRubric((r) => ({
                        ...r,
                        content: toggleHardRequirement(
                          r.content,
                          hr.id,
                          enabled
                        ),
                      }))
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
            Scoring scale
          </h2>
          <Card className="shadow-sm border-slate-200/80">
            <CardContent className="pt-6 space-y-2">
              <p className="text-sm text-slate-700">
                Evaluators score each criterion on a{" "}
                <span className="font-medium">
                  {rubric.content.scoringScale.min}–
                  {rubric.content.scoringScale.max}
                </span>{" "}
                scale.
              </p>
              <p className="text-xs text-slate-500">
                {rubric.content.scoringScale.description}
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function ValidationRow({
  categoriesTotal,
  categories,
}: {
  categoriesTotal: number;
  categories: Category[];
}) {
  const offCategories = categories.filter(
    (c) => sum(c.criteria.map((cr) => cr.weight)) !== TOTAL_TARGET
  );
  const categoriesOk = categoriesTotal === TOTAL_TARGET;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge
        variant="outline"
        className={cn(
          "border",
          categoriesOk
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
        )}
      >
        {categoriesOk
          ? "Categories sum to 100% ✓"
          : `Categories sum to ${categoriesTotal}% (should be 100%)`}
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          "border",
          offCategories.length === 0
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
        )}
      >
        {offCategories.length === 0
          ? "All criteria sum to 100% within each category ✓"
          : `${offCategories.length} ${offCategories.length === 1 ? "category" : "categories"} not at 100%`}
      </Badge>
    </div>
  );
}

function CategoryCard({
  category,
  onCategoryWeightChange,
  onCriterionWeightChange,
}: {
  category: Category;
  onCategoryWeightChange: (weight: number) => void;
  onCriterionWeightChange: (criterionId: string, weight: number) => void;
}) {
  const criteriaTotal = sum(category.criteria.map((cr) => cr.weight));
  const criteriaOk = criteriaTotal === TOTAL_TARGET;

  return (
    <Card className="shadow-sm border-slate-200/80">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-xl font-semibold text-slate-900">
              {category.name}
            </CardTitle>
            <p className="text-sm text-slate-500 leading-relaxed">
              {category.description}
            </p>
          </div>
          <PercentInput
            id={`cat-${category.id}-weight`}
            label="Category weight"
            value={category.weight}
            onChange={onCategoryWeightChange}
          />
        </div>
      </CardHeader>
      <CardContent>
        <Separator className="mb-4" />
        <div className="space-y-3">
          {category.criteria.map((cr) => (
            <div
              key={cr.id}
              className="flex items-start gap-4 py-1"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm">{cr.name}</p>
                <p className="text-xs text-slate-500 leading-snug line-clamp-2">
                  {cr.description}
                </p>
              </div>
              <PercentInput
                id={`cr-${category.id}-${cr.id}-weight`}
                label={`${cr.name} weight`}
                value={cr.weight}
                onChange={(w) => onCriterionWeightChange(cr.id, w)}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <span
            className={cn(
              "text-xs font-medium",
              criteriaOk ? "text-emerald-600" : "text-amber-600"
            )}
          >
            Criteria total: {criteriaTotal}%
            {criteriaOk ? " ✓" : ""}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function HardRequirementRow({
  requirement,
  onToggle,
}: {
  requirement: HardRequirement;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 text-sm">{requirement.name}</p>
        <p className="text-xs text-slate-500 leading-snug">
          {requirement.description}
        </p>
      </div>
      <Switch
        id={`hr-${requirement.id}`}
        checked={requirement.enabled}
        onCheckedChange={onToggle}
        aria-label={`Enforce ${requirement.name}`}
      />
    </div>
  );
}

function PercentInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  // Local string buffer lets the user clear/edit the field freely.
  // Resync from the external `value` only when it changes from the outside
  // (e.g. reset to defaults) by tracking the last value we observed.
  const [draft, setDraft] = useState<string>(String(value));
  const [lastValue, setLastValue] = useState<number>(value);

  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }

  return (
    <div className="shrink-0 flex flex-col items-end gap-1">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const parsed = Number.parseInt(draft, 10);
            const clamped = clamp(Number.isFinite(parsed) ? parsed : value, 0, 100);
            setDraft(String(clamped));
            setLastValue(clamped);
            onChange(clamped);
          }}
          className="w-20 pr-6 text-right"
        />
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-slate-500">
          %
        </span>
      </div>
    </div>
  );
}
