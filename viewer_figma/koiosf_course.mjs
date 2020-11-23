import {DomList,subscribe,getElement,ForAllElements,setElementVal,publish,GetJson,LinkClickButton,LinkToggleButton,ForceButton,LinkVisible,GetURLParam,FindDomidWithId,appendElementVal,ConvertDurationToString} from '../lib/koiosf_util.mjs';
import {} from './koiosf_literature.mjs'// must be initialised to be able to follow up on setcurrentcourse
import {GlobalLessonList} from './koiosf_lessons.mjs'// must be initialised to be able to follow up on setcurrentcourse
import {GetToggleState} from '../genhtml/startgen.mjs'

class CourseList {    
    constructor (source) {
        this.CourseListPromise=GetJson(source)        
    }
 
    async GetList() {
        return await this.CourseListPromise;
    }
    
    GetMyList() {
        var mycourses=localStorage.getItem("mycourses")
        if (!mycourses) return [];
        return JSON.parse(mycourses)
    }
    
    async GetCourseData(ccid) {
        var listofcourses=await this.GetList(); 
        if (!ccid) return undefined;
        if (!listofcourses) return undefined;
        return listofcourses[ccid];
    }
    
    async GetCurrentCourseData() {
        return this.GetCourseData(this.GetCurrentCourse())
    }
    
    UpdateMyList(courseid,fremove) {
        var cl=this.GetMyList();
        if (!cl) cl=[];
        if (fremove) {
            var pos = cl.indexOf(courseid);
            if (pos >=0 ) {
                cl.splice(pos,1);
            }
        } else {       
            if (cl.includes(courseid)) return; // check for duplicates
            cl.push(courseid); 
        }
        localStorage.setItem("mycourses", JSON.stringify(cl))
        
        if (fremove || (cl.length==1)) { // if just 1 course present => select that one
            var current=this.GetCurrentCourse();
            if (current == courseid) {
                var first=cl[0];  //could be undefined
                this.SetCurrentCourse(first)
            }
        }
        if (!fremove && (cl.length==1)) { // if just 1 course present => select that one
            var first=cl[0];  //could be undefined
            this.SetCurrentCourse(first)
        }
    }
    
    SetCurrentCourse(courseid) {
        var prevcourse=this.GetCurrentCourse()
        localStorage.setItem("courseid", courseid);  // this is how the player knows what is selected
        
        if (prevcourse != courseid)
            publish("unsetcurrentcourse",prevcourse) // broadcast to remove previouse course        
        
        publish("setcurrentcourse",courseid) // broadcast there is a new current course
    }

    GetCurrentCourse() {
        var cid=localStorage.getItem("courseid"); 
		if (!cid) cid="howtouse01"        
        return cid;
    }

    async LoadCurrentCourse() { // only do this 1 time, because takes the url parameters
        var list=await this.GetList()
        var courseid=GetURLParam("course")
        if (list[courseid]) // then a valid courseid      
            this.SetCurrentCourse(courseid)         // also does publish
        else {
            courseid=this.GetCurrentCourse()         
            publish("setcurrentcourse",courseid) //courseid could be undefined        
        }        
    }
}    

var courseinfo=GetURLParam("courseinfo")
if (!courseinfo) courseinfo="https://koiosonline.github.io/lib/viewer_figma/courseinfo.json"
export var GlobalCourseList=new CourseList(courseinfo);

export async function GetCourseInfo(key,courseid) {
    var defaultreturn;
	var override=GetURLParam(key)
	if (override) {
		return(override)
	}
	
    switch (key) {
        case "slides": defaultreturn="QmWUXkvhWoaULAA1TEPv98VUYv8VqsiuuhqjHHBAmkNw2E";break;
        case "videoinfo": defaultreturn="QmUj3D5yMz5AMPBHVhFdUF2CpadeHDsEuyr1MSNjT5m31R";break;
    }
    
    if (!courseid) courseid=GlobalCourseList.GetCurrentCourse()   
    var listofcourses = await GlobalCourseList.GetList();
    if (!courseid) return defaultreturn;
    if (!listofcourses) return defaultreturn;
	if (!listofcourses[courseid]) return defaultreturn;
    
    return listofcourses[courseid][key];
}

var globaldomlistcoursesother;
var globaldomlistcoursesmy;

async function asyncloaded() {    
    LinkVisible("scr_other"  ,ScrOtherMadeVisible)    
    LinkVisible("scr_my"     ,ScrMyMadeVisible)        
    LinkVisible("scr_profile",ScrProfileMadeVisible)    
    LinkVisible("scr_viewer" ,ScrViewerMadeVisible)    
    LinkVisible("scr_detail" ,ScrDetailMadeVisible)    
	LinkVisible("scr_added_course" ,ScrAddedCourseMadeVisible)    
	
	ScrDetailMadeVisible
    
    LinkClickButton("selectcourse",SelectCourse)     
    LinkClickButton("removecourse",RemoveCourse) 
    
    subscribe("setcurrentcourse",SetCurrentCourseOnScreen)
    subscribe("unsetcurrentcourse",UnSetCurrentCourseOnScreen)
    
    globaldomlistcoursesother = new DomList("courselistitem",getElement("scr_other"))
    globaldomlistcoursesmy = new DomList("courselistitem",getElement("scr_my"))
    
    subscribe("receivedparenturl",NewOrgLocation);
    await GlobalCourseList.LoadCurrentCourse()
}    

function NewOrgLocation() {
    var courseid=GetURLParam("course")
    if (courseid)
        GlobalCourseList.SetCurrentCourse(courseid)
}

async function ScrOtherMadeVisible() {
	getElement("btnmycourses","scr_my").dispatchEvent(new CustomEvent("displayactive")); // then hide the join button
    var listofcourses=await GlobalCourseList.GetList();    
    globaldomlistcoursesother.EmptyList()
    var ml=GlobalCourseList.GetMyList();   
    for (const course in listofcourses) {    
        if (ml.includes(course) ) continue; // skip my course        		
        var c1 = globaldomlistcoursesother.AddListItem()        		
        var data=listofcourses[course]        
        var mask=[["courselevel","__label"],["image","__icon"]]; 
            ForAllElements(data, mask, (id,val) => { setElementVal(id,val,c1) }) // find domid object with same name and copy value
			
		var duration=ConvertDurationToString(data.duration)
		if (duration)
			appendElementVal("__label",`\nT: ${duration}`,c1)			
			
        c1.id=course; // to be able to access it later
        c1.dataset.whattoselect="other"
		
		var seen=GlobalLessonList.GetCourseSeen(course)
		if (!seen) seen=0
		var perc=parseInt(100 * parseInt(seen) / parseInt(data.duration))
		getElement("progressbar",c1).style.width=`${perc}%`
    }

    LinkToggleButton("topicit",TopicOnOff) 
    LinkToggleButton("topicpolitics",TopicOnOff) 
    LinkToggleButton("topicentrep",TopicOnOff) 
    LinkToggleButton("topicdata",TopicOnOff) 
    LinkToggleButton("topiclaw",TopicOnOff) 
    LinkToggleButton("topiceconomics",TopicOnOff) 
    LinkToggleButton("topicfinance",TopicOnOff) 
     
    ForceButton("topicit",true);
    ForceButton("topicpolitics",true);
    ForceButton("topicentrep",true);
    ForceButton("topicdata",true);
    ForceButton("topiclaw",true);
    ForceButton("topiceconomics",true);
    ForceButton("topicfinance",true);
}    

function  TopicOnOff(event) {
    var mask=this.classList[1]
    console.log("Mask: ", mask);
    var fOn=GetToggleState(this,"displayactive"); 
    ShowItems(mask,fOn);
}

function ShowItems(tag,fOn) {
    GlobalUrlList.FilterDataset("type",tag,fOn,true);
}

async function ScrMyMadeVisible() {
	getElement("btnmycourses","scr_my").dispatchEvent(new CustomEvent("displayactive")); // then hide the join button
    var listofcourses=await GlobalCourseList.GetList();    
    var ml=GlobalCourseList.GetMyList();
    var current=GlobalCourseList.GetCurrentCourse()
    globaldomlistcoursesmy.EmptyList()    
    for (const course in listofcourses) {   
        if (!ml.includes(course) ) continue; // skip othercourses 		
        var c1 = globaldomlistcoursesmy.AddListItem()    
        var data=listofcourses[course]        
        var mask=[["courselevel","__label"],["image","__icon"]]; 
        ForAllElements(data, mask, (id,val) => { setElementVal(id,val,c1) }) // find domid object with same name and copy value
		var duration=ConvertDurationToString(data.duration)
		if (duration)
			appendElementVal("__label",`\nT: ${duration}`,c1)					
        c1.id=course; // to be able to access it later
        c1.dataset.whattoselect="my"

		var seen=GlobalLessonList.GetCourseSeen(course)
        if (!seen) seen = 0
        
		var perc=parseInt(100 * parseInt(seen) /  parseInt(data.duration))
		getElement("progressbar",c1).style.width=`${perc}%`
    }
    publish("setcurrentcourse",current)
}    

function UnSetCurrentCourseOnScreen(prevcourse) {
    var domid=getElement(prevcourse,"scr_my")    
    if (domid) {  
        var domidclick=getElement("@click",domid)    
        domidclick.dispatchEvent(new CustomEvent("displaydefault")); 
    }
}    

function SetCurrentCourseOnScreen(newcourse) {
    var domid=getElement(newcourse,"scr_my")   
    if (domid) {   
        var domidclick=getElement("@click",domid)    
        domidclick.dispatchEvent(new CustomEvent("displayactive")); 
    }
}
    


async function ScrProfileMadeVisible() {
    getElement("btnprofile","scr_profile").dispatchEvent(new CustomEvent("displayactive")); // then hide the join button
    var coursedetails=await GlobalCourseList.GetCurrentCourseData()
	
	var strcurrentcourse=coursedetails?coursedetails.courselevel:"No course selected yet";
	setElementVal("currentcoursename",strcurrentcourse,getElement("scr_profile"))
	if (!coursedetails) return 
  
    var data=(await GlobalCourseList.GetCurrentCourseData());
    var mask=[["courselevel","currentcoursename"],["image","courseicon"]]; 
    if (data)
        ForAllElements(data, mask, (id,val) => { setElementVal(id,val,getElement("scr_profile")) }) // find domid object with same name and copy value

	var duration=ConvertDurationToString(data.duration)
	if (duration)
		setElementVal("timetotal",duration,"scr_profile")	
}  

subscribe("courseseenupdated",CourseSeenUpdated)

function CourseSeenUpdated() {
	var currentcourse=GlobalCourseList.GetCurrentCourse()
	var seen=GlobalLessonList.GetCourseSeen(currentcourse)  
	setElementVal("timewatched",ConvertDurationToString(seen),"scr_profile")
}

async function ScrViewerMadeVisible() {
	var coursedetails=await GlobalCourseList.GetCurrentCourseData()
    var strcurrentcourse=coursedetails?coursedetails.courselevel:"No course selected yet";
        setElementVal("currentcoursename",strcurrentcourse,"scr_viewer")
    if (!coursedetails) return 
     
    var data=(await GlobalCourseList.GetCurrentCourseData());
    var mask=[["courselevel","currentcoursename"],["image","courseicon"]]; 
    ForAllElements(data, mask, (id,val) => { setElementVal(id,val,getElement("scr_viewer")) }) // find domid object with same name and copy value
}    

var originalbutton;

async function ScrDetailMadeVisible(event) {
    var target=FindDomidWithId(event);
    var courseid=target.id;
    //var whattoselect=target.dataset.whattoselect; - Unused
    originalbutton=target;
         
    if (courseid) {
        var data=await GlobalCourseList.GetCourseData(courseid) 
        var mask=["course","courselevel","level","contributer","level","subtitle","description","goal","start","duration","contributerdescription",["image","courseicon"]]; 
        ForAllElements(data, mask, (id,val) => { setElementVal(id,val,getElement("scr_detail")) }) // find domid object with same name and copy value
    }
}

function SelectCourse(event) {
    var courseid=originalbutton.id
    var whattoselect=originalbutton.dataset.whattoselect

    switch (whattoselect) {
        case "my":
            GlobalCourseList.SetCurrentCourse(courseid)        // also updates the screen
            break;
        case "other":
            GlobalCourseList.UpdateMyList(courseid)
			GlobalCourseList.SetCurrentCourse(courseid)        // also updates the screen // also update the current course
            var domidclick=getElement("@click",originalbutton)    
            domidclick.dispatchEvent(new CustomEvent("hide"));  
            break;
    }
}    

function RemoveCourse(event) {
    var courseid=originalbutton.id
    var whattoselect=originalbutton.dataset.whattoselect
    switch (whattoselect) {
        case "my":
            GlobalCourseList.UpdateMyList(courseid,true)
			originalbutton.style.display="none" // parentNode.parentNode.parentNode.
            break;
        case "other":
            break;
    }
}   

async function ScrAddedCourseMadeVisible() {
    var data=(await GlobalCourseList.GetCurrentCourseData());
    var mask=[["courselevel","currentcoursename"],["image","courseicon"]]; 
    if (data)
        ForAllElements(data, mask, (id,val) => { setElementVal(id,val,getElement("scr_added_course ")) }) // find domid object with same name and copy value
}

window.addEventListener('DOMContentLoaded', asyncloaded);  // load  