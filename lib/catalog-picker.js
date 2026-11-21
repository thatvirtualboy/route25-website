function languagePicker(selected = "international", { sets = false } = {}) {
  const choices = [["international", "English"], ["jp", "Japanese"], ["cn", "Chinese"]];
  if (sets) choices.unshift(["all", "All"]);
  return `<div class="${sets ? "set-language-filter" : "region-toggle"}" role="group" aria-label="${sets ? "Set" : "Card"} language">${choices.map(([region, name]) =>
    `<button class="region-option" type="button" ${sets ? "data-set-language" : "data-region"}="${region}" aria-pressed="${region === selected}">${name}</button>`
  ).join("")}</div>`;
}

module.exports = { languagePicker };
