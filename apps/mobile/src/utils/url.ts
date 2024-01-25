export const isPossibleDomain = (str: string) => {
  var domainRegex = /^(?:\S(?:\S{0,61}\S)?\.)+\S{2,}$/;

  return domainRegex.test(str);
};
