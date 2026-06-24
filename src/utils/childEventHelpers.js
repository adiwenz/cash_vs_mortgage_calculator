export function getChildEventBirthAge(event) {
  return Number(
    event?.birthAge ??
    event?.arrivalAge ??
    event?.parentAge ??
    event?.age ??
    event?.startAge ??
    event?.timing?.age ??
    event?.data?.birthAge ??
    event?.data?.parentAge ??
    event?.details?.birthAge
  );
}

export function setChildEventBirthAge(event, birthAge) {
  const numericAge = Number(birthAge);
  return {
    ...event,
    age: numericAge,
    startAge: numericAge,
    birthAge: numericAge,
    arrivalAge: numericAge,
    parentAge: numericAge,
    timing: {
      ...(event?.timing || {}),
      age: numericAge,
    },
    data: {
      ...(event?.data || {}),
      birthAge: numericAge,
      parentAge: numericAge,
    },
    details: {
      ...(event?.details || {}),
      birthAge: numericAge,
    },
  };
}
