export const timeConvert = (num) => {
  const hours = Math.floor(num / 60);
  const minutes = num % 60;
  return `${hours}:${minutes === 0 ? '00': minutes}`;
};

export const getDate = (date) => {
  const dateCorrected = new Date(new Date(date).toLocaleString('en-US'));
  return dateCorrected.toLocaleString('en-GB').slice(0,10);
}

export const getDateDDMMYYYY = (date) => {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

export const getDateFormatted = (date: Date) => {
  const dateString = date.toISOString().slice(0,10);
  return dateString;
}