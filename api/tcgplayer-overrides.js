const TCGPLAYER_PRODUCT_OVERRIDES = {
  "me3-94": {
    productId: "684415",
    slug: "pokemon-me03-perfect-order-clefairy-094-088",
    label: "TCGPlayer"
  },
  "me3-102": {
    productId: "684361",
    slug: "pokemon-me03-perfect-order-mega-starmie-ex-102-088",
    label: "TCGPlayer"
  },
  "me4-22": {
    productId: "693515",
    slug: "pokemon-me04-chaos-rising-mega-greninja-ex-022-086",
    label: "TCGPlayer"
  }
};

function cardKey(cardOrId) {
  if (typeof cardOrId === "string") return cardOrId.trim().toLowerCase();
  const id = String(cardOrId?.id || "").trim().toLowerCase();
  if (id) return id;
  const setId = String(cardOrId?.set?.id || "").trim().toLowerCase();
  const number = String(cardOrId?.number || "").trim().toLowerCase();
  return setId && number ? `${setId}-${number}` : "";
}

function tcgplayerProductOverride(cardOrId) {
  return TCGPLAYER_PRODUCT_OVERRIDES[cardKey(cardOrId)] || null;
}

function hasTcgplayerProductId(variants, productId) {
  return variants.some((variant) => {
    return String(variant?.sourceRefs?.tcgplayerProductId || "") === String(productId || "");
  });
}

function withTcgplayerProductOverride(card) {
  const override = tcgplayerProductOverride(card);
  if (!card || !override?.productId) return card;

  const variants = Array.isArray(card.cardVariants) ? card.cardVariants : [];
  if (hasTcgplayerProductId(variants, override.productId)) return card;

  return {
    ...card,
    cardVariants: [
      {
        id: `${card.id || cardKey(card)}:tcgplayer`,
        cardId: card.id || cardKey(card),
        label: override.label || "TCGPlayer",
        sourceRefs: {
          tcgplayerProductId: override.productId,
          tcgplayerSlug: override.slug
        },
        isDefault: variants.length === 0
      },
      ...variants
    ]
  };
}

module.exports = {
  tcgplayerProductOverride,
  withTcgplayerProductOverride
};
