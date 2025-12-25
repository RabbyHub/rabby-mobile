type WorkerMsg<T extends string, P extends object = void> = {
  type: T;
} & (P extends void ? {} : P);

type WorkerReq<T extends string, P extends object = void> = WorkerMsg<T, P> & {
  reqid: string;
};

type WorkerResponse<
  T extends string,
  P = unknown,
> = WorkerMsg<`response:${T}`> & {
  reqid: string;
  errorCode?: string | number;
  error?: string;
  data?: P;
};

type WorkerDuplexDefs = {
  // '_ack': {
  //   post: WorkerMsg<'ack'>;
  //   response: WorkerResponse<'ack', {
  //     time: number;
  //   }>;
  // };
  _DevTest: {
    post: WorkerReq<'@DevTest'> & {
      purpose: 'triggerError' | 'triggerGC';
    };
    response: WorkerResponse<
      '@DevTest',
      {
        result?: string;
      }
    >;
  };
  // '_error': {
  //   post: WorkerReq<'@error'> & {
  //     data?: any;
  //   };
  //   response: WorkerResponse<'@error', {
  //     errorCode?: string | number;
  //     error?: string;
  //   }>;
  // };
  plus: {
    post: WorkerReq<'plus'> & {
      leftValue: number;
      rightValue: number;
    };
    response: WorkerResponse<'plus', number>;
  };
  aave_formatReserves: {
    post: WorkerReq<'formatReserves'> & {
      data: Parameters<typeof import('@aave/math-utils').formatReserves>[0];
    };
    response: WorkerResponse<
      'formatReserves',
      {
        result: ReturnType<typeof import('@aave/math-utils').formatReserves>;
      }
    >;
  };
  aave_formatUserSummary: {
    post: WorkerReq<'formatUserSummary'> & {
      data: Parameters<typeof import('@aave/math-utils').formatUserSummary>[0];
    };
    response: WorkerResponse<
      'formatUserSummary',
      {
        result: ReturnType<typeof import('@aave/math-utils').formatUserSummary>;
      }
    >;
  };
  aave_formatReservesAndIncentives: {
    post: WorkerReq<'formatReservesAndIncentives'> & {
      data: Parameters<
        typeof import('@aave/math-utils').formatReservesAndIncentives
      >[0];
    };
    response: WorkerResponse<
      'formatReservesAndIncentives',
      {
        result: ReturnType<
          typeof import('@aave/math-utils').formatReservesAndIncentives
        >;
      }
    >;
  };
  aave_formatUserSummaryAndIncentives: {
    post: WorkerReq<'formatUserSummaryAndIncentives'> & {
      data: Parameters<
        typeof import('@aave/math-utils').formatUserSummaryAndIncentives
      >[0];
    };
    response: WorkerResponse<
      'formatUserSummaryAndIncentives',
      {
        result: ReturnType<
          typeof import('@aave/math-utils').formatUserSummaryAndIncentives
        >;
      }
    >;
  };
};

type WorkerSend = {
  reqid?: string;
  data?: any;
} & (
  | (WorkerMsg<'ack'> & {
      time: number;
    })
  | WorkerMsg<'@notifyReceivedReq'>
  | WorkerMsg<
      '@errorReq',
      {
        errorCode: string | number;
        error: string;
      }
    >
  | WorkerMsg<
      '@catchedError',
      {
        isFatal?: boolean;
        scene?: string;
        error: string;
      }
    >
);

type WorkerSendDict = {
  [P in WorkerSend['type']]: Extract<WorkerSend, { type: P }>;
};

type WorkerDuplexPost = WorkerDuplexDefs[keyof WorkerDuplexDefs]['post'];
type WorkerDuplexPostDict = {
  [P in WorkerDuplexPost['type']]: Extract<WorkerDuplexPost, { type: P }>;
};

type WorkerDuplexReceive =
  | WorkerDuplexDefs[keyof WorkerDuplexDefs]['response']
  | WorkerSend;
type WorkerDuplexReceiveDict = {
  [P in WorkerDuplexPost['type']]: Extract<
    WorkerDuplexReceive,
    { type: `response:${P}` }
  >;
};
