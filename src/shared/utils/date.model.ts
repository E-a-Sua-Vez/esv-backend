import * as dayjs from 'dayjs';
import { ManipulateType } from 'dayjs';
import * as isBetween from 'dayjs/plugin/isBetween';
import * as isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import * as isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import * as timezone from 'dayjs/plugin/timezone';
import * as utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(isBetween);

export class DateModel {
  private dayjsObj: dayjs.Dayjs;

  private readonly DATE_SEPARATOR = '-';

  constructor(dateAsString?: string) {
    this.dayjsObj = dayjs.utc(dateAsString);
  }

  public getInstance(dateAsString?: string) {
    return new DateModel(dateAsString);
  }

  private substract(numberOfUnits: number, units: ManipulateType): DateModel {
    const newDayjsObj = this.dayjsObj.subtract(numberOfUnits, units);
    const dateAsString = newDayjsObj.toString();
    return new DateModel(dateAsString);
  }

  public add(numberOfUnits: number, units: ManipulateType): DateModel {
    const newDayjsObj = this.dayjsObj.add(numberOfUnits, units);
    const dateAsString = newDayjsObj.toString();
    return new DateModel(dateAsString);
  }

  public substractDays(days: number): DateModel {
    return this.substract(days, 'days');
  }

  public addDays(days: number): DateModel {
    const newDayjsObj = this.dayjsObj.add(days, 'days');
    return new DateModel(newDayjsObj.toString());
  }

  public substractMonths(months: number): DateModel {
    return this.substract(months, 'months');
  }

  public addMonths(numberOfMonthsToAdd: number): DateModel {
    return this.add(numberOfMonthsToAdd, 'months');
  }

  public month(): string {
    const [, month] = this.toString().split(this.DATE_SEPARATOR);
    if (!month) {
      throw new Error('error getting month from date');
    }
    return month;
  }

  public year(): string {
    const [year] = this.toString().split(this.DATE_SEPARATOR);
    if (!year) {
      throw new Error('error getting year from date');
    }
    return year;
  }

  public toString(format = 'YYYY-MM-DD'): string {
    return this.dayjsObj.format(format).toString();
  }

  public isSameOrAfter(date: DateModel): boolean {
    const dateAsString = date.toString();
    const dayjsObj = dayjs.utc(dateAsString);
    return this.dayjsObj.isSameOrAfter(dayjsObj);
  }

  public isSameOrBefore(date: DateModel): boolean {
    const dateAsString = date.toString();
    const dayjsObj = dayjs.utc(dateAsString);
    return this.dayjsObj.isSameOrBefore(dayjsObj);
  }

  public isBetween(startDate: DateModel, endDate: DateModel, isBetweenIncludes: '()' | '[]' | '[)' | '(]' = '[]'): boolean {
    const startDateAsString = startDate.toString();
    const endDateAsString = endDate.toString();
    const dayjsObjStart = dayjs.utc(startDateAsString);
    const dayjsObjEnd = dayjs.utc(endDateAsString);
    return this.dayjsObj.isBetween(dayjsObjStart, dayjsObjEnd, 'day', isBetweenIncludes);
  }

  public daysDiff = (dateBefore: DateModel): number => this.dayjsObj.diff(dateBefore.dayjsObj, 'days');

  public monthsDiff = (dateBefore: DateModel): number => this.dayjsObj.diff(dateBefore.dayjsObj, 'months');

  public yearsDiff = (dateBefore: DateModel): number => this.dayjsObj.diff(dateBefore.dayjsObj, 'years');

  public setDateOfMonth(dayOfMonth: number): DateModel {
    const dateAsString = this.dayjsObj.date(dayOfMonth);
    return new DateModel(dateAsString.toString());
  }

  public now(format = 'YYYY-MM-DD'): string {
    return dayjs().format(format);
  }

  // public add(date: string, days: number, unit: dayjs.OpUnitType, format = 'YYYY-MM-DD'): string {
  //   return dayjs(date).add(days, unit).format(format);
  // }

  public format(date: Date, format = 'YYYY-MM-DD'): string {
    return dayjs(date).format(format);
  }

  public transformToBusinessDay(date: string, format = 'YYYY-MM-DD'): string {
    // TODO: Holidays by country
    const day = dayjs(date).get('day');
    if (day === 0) {
      return dayjs(date).add(1, 'day').format(format);
    }
    if (day === 6) {
      return dayjs(date).add(2, 'day').format(format);
    }
    return dayjs(date).format(format);
  }

  public day(): string {
    const [, , day] = this.toString().split(this.DATE_SEPARATOR);
    if (!day) {
      throw new Error('error getting day from date');
    }
    return day;
  }

  public transformToTimezone(argTimezone: string): string {
    return this.dayjsObj.tz(argTimezone).format('YYYY-MM-DD');
  }
}
