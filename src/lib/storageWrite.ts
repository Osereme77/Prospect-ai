export function tryStorageWrite(write:()=>void):boolean{try{write();return true}catch{return false}}
