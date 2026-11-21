function languagePicker(selected = "international") {
  const choices = [["international", "English"], ["jp", "Japanese"], ["cn", "Chinese"]];
  return `<div class="region-toggle" role="group" aria-label="Card language">${choices.map(([region, name]) =>
    `<button class="region-option" type="button" data-region="${region}" aria-pressed="${region === selected}">${name}</button>`
  ).join("")}</div>`;
}

module.exports = { languagePicker };
