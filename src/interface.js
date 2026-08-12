import { MATERIAL_CATALOG } from "./materialCatalog.js";

const CONTROL_DEFINITIONS = Object.freeze([
  ["cabinWidthMm", "Cabin width"],
  ["cabinHeightMm", "Cabin height"],
  ["windowWidthMm", "Window width"],
  ["windowHeightMm", "Window height"],
]);

/** Create accessible native controls and report changes through a single callback. */
export function createInterface(
  container,
  limits,
  configuration,
  onChange,
  onWindowOpenChange,
  materialSelection,
  onMaterialChange,
) {
  const controls = container.querySelector("[data-controls]");
  controls.replaceChildren();

  for (const [key, label] of CONTROL_DEFINITIONS) {
    const field = document.createElement("label");
    field.className = "control";
    field.innerHTML = `
      <span class="control__header">
        <span>${label}</span>
        <output for="${key}">${configuration[key]} mm</output>
      </span>
      <input id="${key}" name="${key}" type="range"
        min="${limits[key].min}" max="${limits[key].max}" step="1"
        value="${configuration[key]}" />
      <span class="control__range">
        <span>${limits[key].min} mm</span><span>${limits[key].max} mm</span>
      </span>`;

    const input = field.querySelector("input");
    const output = field.querySelector("output");
    input.addEventListener("input", () => {
      output.value = `${input.value} mm`;
      onChange(key, Number(input.value));
    });
    controls.append(field);
  }

  const windowSwitch = document.createElement("label");
  windowSwitch.className = "window-switch";
  windowSwitch.innerHTML = `
    <span>
      <strong>Window</strong>
      <small data-window-state>Closed</small>
    </span>
    <input type="checkbox" role="switch" aria-label="Open window" />
    <span class="window-switch__track" aria-hidden="true"></span>`;
  const switchInput = windowSwitch.querySelector("input");
  const stateLabel = windowSwitch.querySelector("[data-window-state]");
  switchInput.addEventListener("change", () => {
    stateLabel.textContent = switchInput.checked ? "Open" : "Closed";
    switchInput.setAttribute("aria-label", switchInput.checked ? "Close window" : "Open window");
    onWindowOpenChange(switchInput.checked);
  });
  controls.append(windowSwitch);

  const materialSection = document.createElement("section");
  const currentVariants = { ...materialSelection };
  materialSection.className = "materials";
  materialSection.innerHTML = `
    <div class="materials__header">
      <h2>Materials</h2>
      <span data-material-status aria-live="polite"></span>
    </div>`;
  const materialStatus = materialSection.querySelector("[data-material-status]");

  for (const [familyId, family] of Object.entries(MATERIAL_CATALOG)) {
    if (family.hidden) continue;

    const fieldset = document.createElement("fieldset");
    fieldset.className = "swatch-group";
    const legend = document.createElement("legend");
    legend.textContent = family.label;
    fieldset.append(legend);

    const options = document.createElement("div");
    options.className = "swatch-group__options";
    for (const [variantId, variant] of Object.entries(family.variants)) {
      const option = document.createElement("label");
      option.className = "swatch";
      option.title = variant.label;
      option.innerHTML = `
        <input type="radio" name="material-${familyId}" value="${variantId}"
          ${materialSelection[familyId] === variantId ? "checked" : ""} />
        <span class="swatch__color" style="--swatch-color: ${variant.color}" aria-hidden="true"></span>
        <span>${variant.label}</span>`;
      const input = option.querySelector("input");
      input.addEventListener("change", async () => {
        if (!input.checked) return;
        const previousVariant = currentVariants[familyId];
        materialStatus.textContent = "Loading…";
        fieldset.disabled = true;
        try {
          await onMaterialChange(familyId, variantId);
          currentVariants[familyId] = variantId;
          materialStatus.textContent = "";
        } catch (error) {
          fieldset.querySelector(`[value="${previousVariant}"]`).checked = true;
          materialStatus.textContent = "Texture unavailable";
          console.error(error);
        } finally {
          fieldset.disabled = false;
        }
      });
      options.append(option);
    }
    fieldset.append(options);
    materialSection.append(fieldset);
  }
  controls.append(materialSection);

  container.querySelector("[data-depth]").textContent = `${limits.cabinDepthMm} mm`;

  return {
    setWindowHeightMaximum(maximumMm, valueMm) {
      const input = container.querySelector("#windowHeightMm");
      const field = input.closest(".control");
      input.max = String(maximumMm);
      input.value = String(valueMm);
      field.querySelector("output").value = `${valueMm} mm`;
      field.querySelector(".control__range span:last-child").textContent = `${maximumMm} mm`;
    },
  };
}
