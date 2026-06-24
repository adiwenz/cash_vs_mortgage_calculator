export function upsertLifeEvent(inputs, event) {
  const newInputs = JSON.parse(JSON.stringify(inputs || {}));
  if (!newInputs.lifeEvents) {
    newInputs.lifeEvents = [];
  }
  const exists = newInputs.lifeEvents.some(e => e.id === event.id);
  if (exists) {
    newInputs.lifeEvents = newInputs.lifeEvents.map(e => e.id === event.id ? event : e);
  } else {
    newInputs.lifeEvents.push(event);
  }
  return newInputs;
}

export function removeLifeEvent(inputs, eventId) {
  const newInputs = JSON.parse(JSON.stringify(inputs || {}));
  if (newInputs.lifeEvents) {
    newInputs.lifeEvents = newInputs.lifeEvents.filter(e => e.id !== eventId);
  }
  return newInputs;
}

export function upsertHouseAsset(inputs, house) {
  const newInputs = JSON.parse(JSON.stringify(inputs || {}));
  if (!newInputs.houseAssets) {
    newInputs.houseAssets = [];
  }
  const exists = newInputs.houseAssets.some(h => h.id === house.id);
  if (exists) {
    newInputs.houseAssets = newInputs.houseAssets.map(h => h.id === house.id ? house : h);
  } else {
    newInputs.houseAssets.push(house);
  }
  return newInputs;
}

export function removeHouseAsset(inputs, houseId) {
  const newInputs = JSON.parse(JSON.stringify(inputs || {}));
  if (newInputs.houseAssets) {
    newInputs.houseAssets = newInputs.houseAssets.filter(h => h.id !== houseId);
  }
  return newInputs;
}

export function updateScenarioField(inputs, path, value) {
  const newInputs = JSON.parse(JSON.stringify(inputs || {}));
  const parts = path.split('.');
  let current = newInputs;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
  return newInputs;
}
