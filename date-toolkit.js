var dateToolkit = (function (exports) {
  'use strict';

  function toDate(d) {
    // null is invalid
    if (d === null) {
      return new Date(NaN);
    }
    // undefined is today
    if (typeof d === 'undefined') {
      return new Date();
    }
    if (d instanceof Date) {
      return new Date(d);
    }
    //everything else
    return new Date(d);
  }

  function get(d) {
    return {
      $Y: d.getFullYear(),
      $M: d.getMonth(),
      $D: d.getDate(),
      $W: d.getDay(),
      $H: d.getHours(),
      $m: d.getMinutes(),
      $s: d.getSeconds(),
      $ms: d.getMilliseconds(),
    };
  }

  function timestampFormat(timestamp) {
    const ms = timestamp % 1000 || 0;
    const unix = (timestamp - ms) / 1000;
    const s = unix % 60 || 0;
    const m = ((unix - s) / 60) % 60 || 0;
    const h = (((unix - s) / 60 - m) / 60) % 24 || 0;
    const d = (((unix - s) / 60 - m) / 60 - h) / 24 || 0;

    return {
      d,
      h,
      m,
      s,
      ms,
    };
  }

  function monthDiff(a, b, float) {
    const first = toDate(a);
    const last = toDate(b);
    const $first = get(first);
    const $last = get(last);

    //保证小数月差的计算顺序都是从小的天数到大的天数开始计算（不然相同的两个日期，变动参数顺序就会进入不同的分支，从而导致计算的小数月差的结果不一致）。
    //因为变动了参数顺序，所以要将结果的符号取反。
    if ($first.$D < $last.$D) {
      return -monthDiff(b, a, float);
    }

    //计算整数月差
    const wholeMonthDiff =
      ($last.$Y - $first.$Y) * 12 + ($last.$M + 1 - ($first.$M + 1));
    const anchor = toDate(first);
    const anchor2 = toDate(first);

    anchor.setMonth($first.$M + wholeMonthDiff);

    // 计算小数月差
    // 计算方法参考[https://github.com/moment/moment/blob/e96809208c9d1b1bbe22d605e76985770024de42/src/lib/moment/diff.js#L54](moment - monthDiff)
    if (float) {
      let adjust;
      //如果日期天数不相等或者天数相等，但是时间不等则会进入该分支。
      //如果 last 在 [anchor-1, anchor] 区间，则该月线性天数为：(anchor - anchor2)
      if (last - anchor < 0) {
        anchor2.setMonth($first.$M + (wholeMonthDiff - 1));
        adjust = (last - anchor) / (anchor - anchor2);
      } else {
        //如果日期天数相等，且 last 的时、分、秒 大于 anchor，则会进入该分支。
        //如果 last 在 (anchor, anchor+1] 区间，则该月线性天数为：(anchor2 - anchor)
        anchor2.setMonth($first.$M + (wholeMonthDiff + 1));
        adjust = (last - anchor) / (anchor2 - anchor);
      }

      //防止 -0 的存在
      return -(wholeMonthDiff + adjust) || 0;
    } else {
      return { M: wholeMonthDiff, ...timestampFormat(last - anchor) };
    }
  }

  function daysInMonth(d) {
    const $d = toDate(d);
    const { $M } = get($d);
    
    // Get the last day of each month based on carry.
    // Since the value of days is 1 - 31, month should be added by 1.
    
    $d.setMonth($M + 1);
    $d.setDate(0);

    return get($d).$D;
  }

  const units = {
    Y: "year",
    M: "month",
    d: "day",
    D: "date",
    W: "week",
    H: "hour",
    m: "minute",
    s: "second",
    ms: "millisecond",
  };

  function pertty(unit) {
    return (
      units[unit] ||
      String(unit || "")
        .toLowerCase()
        .replace(/s$/, "")
    );
  }

  function startOf(d, u, isStartOf = true) {
    const unit = pertty(u);
    const date = toDate(d);
    const { $Y, $D, $M, $W } = get(date);

    const setInstanceDate = (m, d) => {
      const cloneDate = toDate(new Date($Y, m, d));
      return isStartOf ? cloneDate : startOf(cloneDate, units.D, false);
    };

    const setInstanceTime = (method, sliceIndex) => {
      const startOfValues = [0, 0, 0, 0];
      const endOfValues = [23, 59, 59, 999];
      const cloneDate = toDate(date);

      cloneDate[method].apply(
        cloneDate,
        (isStartOf ? startOfValues : endOfValues).slice(sliceIndex)
      );

      return cloneDate;
    };

    switch (unit) {
      case units.Y:
        return isStartOf ? setInstanceDate(0, 1) : setInstanceDate(11, 31);
      case units.M:
        return isStartOf ? setInstanceDate($M, 1) : setInstanceDate($M + 1, 0);
      case units.W:
        return isStartOf
          ? setInstanceDate($M, $D - ($W - 1))
          : setInstanceDate($M, $D + (7 - $W));
      case units.D:
      case units.d:
        return setInstanceTime("setHours", 0);
      case units.H:
        return setInstanceTime("setMinutes", 1);
      case units.m:
        return setInstanceTime("setSeconds", 2);
      case units.s:
        return setInstanceTime("setMilliseconds", 3);
      default:
        return toDate(date);
    }
  }

  function endOf(d, unit) {
    return startOf(d, unit, false);
  }

  function dayOfYear(d) {
    const date = toDate(d);
    return (
      Math.round((startOf(date, units.D) - startOf(date, units.Y)) / 864e5) + 1
    );
  }

  function isLeapYear(d) {
    const date = toDate(d);
    const { $Y } = get(date);

    // 4 年一润；100 年不润；400 年一润。
    // 地球公转的回归年为 365 日 5时 48分 46秒；而我们通常定义一年为 365 天，所以每隔 4 年多出 0.9688 日，因此每四年一润，闰年 366 日。但是四年增加一日，又会比四个回归年多 0.0312 日 
    // (1 - 0.9688) ，400年后将多3.12日,故在400年中少设3个闰年,也就是在400年中只设97个闰年，这样公历年的平均长度与回归年就相近似了。
    // 由此规定：年份是整百数的必须是400的倍数才是闰年，例如1900年、2100年就不是闰年。
    return ($Y % 4 === 0 && $Y % 100 !== 0) || $Y % 400 === 0;
  }

  exports.dayOfYear = dayOfYear;
  exports.daysInMonth = daysInMonth;
  exports.endOf = endOf;
  exports.isLeapYear = isLeapYear;
  exports.monthDiff = monthDiff;
  exports.startOf = startOf;
  exports.timestampFormat = timestampFormat;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

})({});
