export const EVALUATION_RATINGS = [
  { value: "exceeds_requirements", label: "Exceeds Requirements" },
  { value: "meets_requirements", label: "Meets Requirements" },
  { value: "does_not_meet_requirements", label: "Does not Meet Requirements" },
] as const;

export type EvaluationRating = (typeof EVALUATION_RATINGS)[number]["value"];

export const HR_RECOMMENDATIONS = [
  { value: "absorption_to_regular_plantilla", label: "Absorption to Regular Plantilla" },
  { value: "extension_of_contract", label: "Extension of Contract" },
  { value: "transfer_to_another_assignment", label: "Transfer to another assignment" },
  { value: "finish_or_terminate_contract", label: "Finish Contract / Termination of Contract" },
] as const;

export type HrRecommendation = (typeof HR_RECOMMENDATIONS)[number]["value"];

export type EvaluationCriterion = {
  code: string;
  section: string;
  sectionWeight: string;
  letter: string;
  title: string;
  weight: string;
  description: string;
};

export const EVALUATION_CRITERIA: EvaluationCriterion[] = [
  {
    code: "job_knowledge",
    section: "I. Technical / Performance Standard",
    sectionWeight: "60%",
    letter: "A",
    title: "Job Knowledge and Potential",
    weight: "20%",
    description:
      "The degree to which the individual proved his knowledge and understanding of the requirements of the job and the extent of familiarity of skillfulness in performing his job and ability to talk about the job intelligently.",
  },
  {
    code: "productivity",
    section: "I. Technical / Performance Standard",
    sectionWeight: "60%",
    letter: "B",
    title: "Productivity Output",
    weight: "15%",
    description:
      "The ability to turn out expected and required volume of acceptable work output.",
  },
  {
    code: "quality",
    section: "I. Technical / Performance Standard",
    sectionWeight: "60%",
    letter: "C",
    title: "Quality of Work",
    weight: "15%",
    description:
      "The ability to turn out expected required quality of work in terms of accuracy, neatness and thoroughness.",
  },
  {
    code: "customer_relations",
    section: "I. Technical / Performance Standard",
    sectionWeight: "60%",
    letter: "D",
    title: "Customer Relations",
    weight: "10%",
    description:
      "The degree to which the individual maintains cordial relations with customer (internal as well as external) by demonstrating a pleasant, courteous, tactful and sincere disposition in relating to them.",
  },
  {
    code: "job_attitude",
    section: "II. Behavioral Standards",
    sectionWeight: "25%",
    letter: "A",
    title: "Job Attitude",
    weight: "5%",
    description:
      "The degree to which the individual demonstrates sincere interest and enthusiasm to his job, maintains positive outlook towards the company and reacts positively to job.",
  },
  {
    code: "dependability",
    section: "II. Behavioral Standards",
    sectionWeight: "25%",
    letter: "B",
    title: "Dependability",
    weight: "5%",
    description:
      "The extent to which the individual follows work instructions and procedures, supports management decisions and actions, and the need to be constantly supervised, checked and monitored for performance.",
  },
  {
    code: "cooperation",
    section: "II. Behavioral Standards",
    sectionWeight: "25%",
    letter: "C",
    title: "Cooperation",
    weight: "5%",
    description:
      "The degree to which the individual maintains pleasant relationship with fellow employees and superiors and willingness to offer services to others and take part in group efforts.",
  },
  {
    code: "initiative",
    section: "II. Behavioral Standards",
    sectionWeight: "25%",
    letter: "D",
    title: "Initiative",
    weight: "5%",
    description:
      "The degree to which the individual initiates constructive actions and demonstrates capacity for handling job problems or difficulties independently without prodding or waiting for directions.",
  },
  {
    code: "housekeeping",
    section: "II. Behavioral Standards",
    sectionWeight: "25%",
    letter: "E",
    title: "Housekeeping",
    weight: "5%",
    description:
      "The degree to which the individual concerns himself with a clean, safe, secure or orderly work area; protects company property under his custody against theft, damage, loss, mishandling or improper exposures.",
  },
  {
    code: "attendance",
    section: "III. Adherence to Company Rules & Policy",
    sectionWeight: "15%",
    letter: "A",
    title: "Attendance & Punctuality",
    weight: "10%",
    description:
      "The degree to which the individual observes scheduled work days, work hours and break periods.",
  },
  {
    code: "discipline",
    section: "III. Adherence to Company Rules & Policy",
    sectionWeight: "15%",
    letter: "B",
    title: "Discipline",
    weight: "5%",
    description:
      "The extent to which the individual exhibits honesty at work and acts according to the norm of right conduct and comply with the company rules and regulations.",
  },
];

export const PDF_OVERALL_RATING_REFERENCE = [
  { range: "80–100", label: "Exceeds Requirements" },
  { range: "40–79", label: "Meets Requirements" },
  { range: "5–39", label: "Does not Meet Requirements" },
] as const;

export function ratingLabel(value: string | null): string {
  return EVALUATION_RATINGS.find((rating) => rating.value === value)?.label ?? "Not selected";
}

export function recommendationLabel(value: string | null): string {
  return HR_RECOMMENDATIONS.find((item) => item.value === value)?.label ?? "Not recorded";
}

export function criteriaSections(): { title: string; weight: string; criteria: EvaluationCriterion[] }[] {
  const sections: { title: string; weight: string; criteria: EvaluationCriterion[] }[] = [];
  for (const criterion of EVALUATION_CRITERIA) {
    const current = sections.at(-1);
    if (!current || current.title !== criterion.section) {
      sections.push({ title: criterion.section, weight: criterion.sectionWeight, criteria: [criterion] });
    } else {
      current.criteria.push(criterion);
    }
  }
  return sections;
}
