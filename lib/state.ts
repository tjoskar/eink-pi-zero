export function createState<T>(initialValue: T) {
  let value = initialValue;
  return {
    get: () => value,
    set: (newValue: T) => {
      value = newValue;
    },
  };
}
