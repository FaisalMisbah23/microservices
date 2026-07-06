export {};

declare global {
  var signin: () => Promise<string[]>;
}

