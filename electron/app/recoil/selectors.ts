import { selector, selectorFamily } from "recoil";
import * as atoms from "./atoms";
import { generateColorMap } from "../utils/colors";
import { makeLabelNameGroups } from "../utils/labels";

export const viewStages = selector({
  key: "viewStages",
  get: ({ get }) => {
    return get(atoms.stateDescription).viewStages;
  },
});

export const numViewStages = selector({
  key: "numStages",
  get: ({ get }) => {
    return get(viewStages).length;
  },
});

export const datasetName = selector({
  key: "datasetName",
  get: ({ get }) => {
    const stateDescription = get(atoms.stateDescription);
    return stateDescription.dataset ? stateDescription.dataset.name : null;
  },
});

export const datasetStats = selector({
  key: "datasetStats",
  get: ({ get }) => {
    const stateDescription = get(atoms.stateDescription);
    return stateDescription.derivables
      ? stateDescription.derivables.view_stats
      : {};
  },
});

export const numSamples = selector({
  key: "numSamples",
  get: ({ get }) => {
    return get(atoms.stateDescription).count;
  },
});

export const tagNames = selector({
  key: "tagNames",
  get: ({ get }) => {
    const stateDescription = get(atoms.stateDescription);
    return (
      (stateDescription.derivables && stateDescription.derivables.tags) || []
    );
  },
});

export const tagSampleCounts = selector({
  key: "tagSampleCounts",
  get: ({ get }) => {
    return get(atoms.stateDescription).derivables.view_stats.tags || {};
  },
});

export const fieldSchema = selector({
  key: "fieldSchema",
  get: ({ get }) => {
    const derivables = get(atoms.stateDescription).derivables || {};
    return derivables.field_schema || {};
  },
});

export const labelNames = selector({
  key: "labelNames",
  get: ({ get }) => {
    const stateDescription = get(atoms.stateDescription);
    const stats = get(datasetStats);
    if (!stateDescription.derivables || !stateDescription.derivables.labels) {
      return [];
    }
    return stateDescription.derivables.labels
      .map((label) => label._id.field)
      .filter((name) => stats.custom_fields.hasOwnProperty(name));
  },
});

export const labelTypes = selector({
  key: "labelTypes",
  get: ({ get }) => {
    const labels = (get(atoms.stateDescription).derivables || {}).labels || [];
    const names = get(labelNames);
    const types = {};
    for (const label of labels) {
      if (names.includes(label._id.field)) {
        types[label._id.field] = label._id.cls;
      }
    }
    return types;
  },
});

export const labelClasses = selectorFamily({
  key: "labelClasses",
  get: (label) => ({ get }) => {
    return get(atoms.stateDescription).derivables.view_stats.labels[label]
      .classes;
  },
});

export const labelSampleCounts = selector({
  key: "labelSampleCounts",
  get: ({ get }) => {
    return get(datasetStats).custom_fields || {};
  },
});

export const labelFilters = selector({
  key: "labelFilters",
  get: ({ get }) => {
    const labels = get(atoms.activeLabels);
    const filters = {};
    for (const label in labels) {
      const range = get(atoms.filterLabelConfidenceRange(label));
      const none = get(atoms.filterLabelIncludeNoConfidence(label));
      const include = get(atoms.filterIncludeLabels(label));
      filters[label] = (s, useValue = false) => {
        const inRange = range[0] <= s.confidence && s.confidence <= range[1];
        const noConfidence = none && s.confidence === undefined;
        const isIncluded =
          include.length === 0 ||
          include.includes(useValue ? s.value : s.label);
        return (inRange || noConfidence) && isIncluded;
      };
    }
    return filters;
  },
});

export const modalLabelFilters = selector({
  key: "modalLabelFilters",
  get: ({ get }) => {
    const labels = get(atoms.modalActiveLabels);
    const filters = {};
    for (const label in labels) {
      const range = get(atoms.modalFilterLabelConfidenceRange(label));
      const none = get(atoms.modalFilterLabelIncludeNoConfidence(label));
      const include = get(atoms.modalFilterIncludeLabels(label));
      filters[label] = (s, useValue = false) => {
        const inRange = range[0] <= s.confidence && s.confidence <= range[1];
        const noConfidence = none && s.confidence === undefined;
        const isIncluded =
          include.length === 0 ||
          include.includes(useValue ? s.value : s.label);
        return (inRange || noConfidence) && isIncluded;
      };
    }
    return filters;
  },
  set: ({ get, set }, _) => {
    const active = get(atoms.activeLabels);
    set(atoms.modalActiveLabels, active);
    for (const label in active) {
      set(
        atoms.modalFilterLabelConfidenceRange(label),
        get(atoms.filterLabelConfidenceRange(label))
      );

      set(
        atoms.modalFilterLabelIncludeNoConfidence(label),
        get(atoms.filterLabelIncludeNoConfidence(label))
      );

      set(
        atoms.modalFilterIncludeLabels(label),
        get(atoms.filterIncludeLabels(label))
      );
    }
  },
});

export const refreshColorMap = selector({
  key: "refreshColorMap",
  get: ({ get }) => get(atoms.colorMap),
  set: ({ get, set }, colorMap) => {
    set(
      atoms.colorMap,
      generateColorMap([...get(tagNames), ...get(labelNames)], colorMap)
    );
  },
});

export const isLabel = selectorFamily({
  key: "isLabel",
  get: (field) => ({ get }) => {
    const types = get(labelTypes);
    return Boolean(types[field]);
  },
});

export const fieldIsFiltered = selectorFamily({
  key: "fieldIsFiltered",
  get: (field) => ({ get }) => {
    const label = get(isLabel(field));
    const range = get(atoms.filterLabelConfidenceRange(field));
    const none = get(atoms.filterLabelIncludeNoConfidence(field));
    const include = get(atoms.filterIncludeLabels(field));
    return (
      label &&
      !([0, 1].every((b, i) => b === range[i]) && none && !include.length)
    );
  },
});

export const labelConfidenceBounds = selectorFamily({
  key: "labelConfidenceBounds",
  get: (label) => ({ get }) => {
    return get(atoms.stateDescription).derivables.view_stats.labels[label]
      .confidence_bounds;
  },
});

export const numericFieldBounds = selectorFamily({
  key: "numericFieldBounds",
  get: (label) => ({ get }) => {
    return get(atoms.stateDescription).derivables.view_stats
      .numeric_field_bounds[label];
  },
});

export const labelNameGroups = selector({
  key: "labelNameGroups",
  get: ({ get }) =>
    makeLabelNameGroups(get(fieldSchema), get(labelNames), get(labelTypes)),
});

export const isNumericField = selectorFamily({
  key: "isNumericField",
  get: (name) => ({ get }) => Boolean(get(numericFieldBounds(name))),
});
