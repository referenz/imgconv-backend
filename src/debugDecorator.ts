function debugDecorator() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (process.env.NODE_ENV !== 'development') return;
    const original = descriptor.value;
    descriptor.value = function (...args: unknown[]) {
      const retVal = original.call(this, ...args);
      console.log(`Debug: ${target.constructor.name}.${propertyKey};`);
      //const argumente = args.map((arg, i) => ` Arg ${i}: ${typeof arg}`);
      const argumente = args.reduce((acc, curr, i) => `${acc} Arg ${i + 1}: ${typeof curr},`, '');
      console.log(`Args: ${(argumente as string).slice(0, -1)}`);
      console.log(`-> ${retVal}`);
      console.log();
      return retVal;
    };
  };
}

export default debugDecorator;
