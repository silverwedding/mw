import fetch from 'node-fetch';
import isWeekend from 'date-fns/isWeekend';
import isToday from 'date-fns/isToday';

const FIRST_PAGE = 1;
const PAGES_PER_REQUEST = 10;

interface Visit {
  id: number;
  name: string;
  date: string
}

interface Visitors {
  [visitorName: string]: number
}

async function run() {
  const token = await getToken();

  if (!token) {
    return;
  }

  const it = makeVisitsIterator(FIRST_PAGE, token, PAGES_PER_REQUEST);
  let result = await it.next();
  let visitors = {};
  while (!result.done) {
    const visits = formatVisitors(result);
    visitors = countVisitors(visitors, visits);
    result = await it.next();
  }

  return visitors;
}

function countVisitors(visitors: Visitors, visits: Visit[]) {
  visitors = visits.reduce((acc, curr) => {
    if (isWeekend(new Date(curr.date)) || isToday(new Date(curr.date))) {
      return acc;
    }

    if (acc[curr.name]) {
      acc[curr.name] += 1;
    } else {
      acc[curr.name] = 1;
    }

    return acc;
  }, visitors);
  return visitors;
}

function makeVisitsIterator(start = 1, token: string, increment = 10) {
  let nextIndex = start;

  const visitsIterator = {
    next: async function () {
      let result;

      try {
        const requests = [];

        for (let i = nextIndex; i < nextIndex + increment; i++) {
          requests.push(getVisits(i, token));
        }

        const visits = await Promise.all(requests);

        const allPagesHaveData = visits.every(
          (visit) => visit !== null && visit?.data?.length,
        );

        if (allPagesHaveData) {
          result = { value: visits, done: false };
          nextIndex += 1;
          return result;
        }

        const somePagesHaveData = visits.some(
          (visit) => visit !== null && visit?.data?.length,
        );

        if (somePagesHaveData) {
          result = { value: visits, done: true };
          nextIndex += 1;
          return result;
        }

        return { value: null, done: true };
      } catch (e) {
        console.error(e);
        return { value: null, done: true };
      }
    },
  };

  return visitsIterator;
}

async function getToken() {
  try {
    const login = await fetch(
      'https://motorway-challenge-api.herokuapp.com/api/login',
    );
    const { token } = await login.json();

    return token;
  } catch (e) {
    console.error(e);
  }

  return null;
}

function formatVisitors(result) {
  return result.value
    .filter((value) => value !== null)
    .map((value) => value.data)
    .flat();
}

async function getVisits(page: number, token: string) {
  try {
    const response = await fetch(
      `https://motorway-challenge-api.herokuapp.com/api/visits?page=${page}&token=${token}`,
    );
    const visits = await response.json();

    return visits;
  } catch (e) {
    return null;
  }
}

run()
  .then((visitors) => {
    if (visitors) {
      console.log(visitors);
    }

    process.exit(1);
  })
  .catch(() => {
    process.exit(0);
  });
