export const timeConvert = (num) => {
  const hours = Math.floor(num / 60);
  const minutes = num % 60;
  return `${hours}:${minutes === 0 ? '00': minutes}`;
};