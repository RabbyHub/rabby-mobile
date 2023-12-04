// fork from https://github.com/omerman/jotai-nexus
import {useEffect} from 'react';
import {Getter, Setter, Atom, WritableAtom} from 'jotai';
import {useAtomCallback} from 'jotai/utils';
let _get!: Getter;
let _set!: Setter;

const initFn = (get: Getter, set: Setter) => {
  _get = get;
  _set = set;
};

export const JotaiNexus: React.FC = () => {
  const initReader = useAtomCallback(initFn);
  useEffect(() => {
    initReader();
  }, [initReader]);
  return null;
};

export default JotaiNexus;
export const readAtom = <A extends Atom<any>>(
  a: A,
): A extends Atom<infer Data> ? Data : never => _get(a);
export const writeAtom = <A extends WritableAtom<any, any, any>>(
  a: A,
  update: A extends WritableAtom<any, infer Update, any> ? Update : never,
) => a.write(_get, _set, update);
