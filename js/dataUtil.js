class DataUtil{
    dataAdd(str,obj){
        if(str==""){
            let result=JSON.stringify([obj]);
            return result;
        }else{
            console.log(JSON.parse(str));
            let list = Array(JSON.parse(str));
            list.push(obj);
            return JSON.stringify(list);
        }
    }
    dataDel(){
    }
}