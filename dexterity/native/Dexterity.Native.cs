using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Speech.Recognition;
using System.Speech.Synthesis;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Automation;
using System.Windows.Forms;

// Only gesture state is retained. Ordinary keys are neither stored nor emitted.
public sealed class Gestures {
    long ctrlAt = -1, lastClick = -1, firstClick = -1;
    bool fired, cancelled;
    int clicks, x, y;
    public void Control(bool down, long now) {
        if (down && ctrlAt < 0) { ctrlAt = now; fired = false; cancelled = false; }
        if (!down) { ctrlAt = -1; fired = false; cancelled = false; }
    }
    public void OtherKey() { if (ctrlAt >= 0) cancelled = true; clicks = 0; }
    public bool Tick(long now) {
        if (ctrlAt >= 0 && !fired && !cancelled && now - ctrlAt >= 3000) { fired = true; return true; }
        return false;
    }
    public bool Click(long now, int px, int py, bool left) {
        if (!left) { clicks = 0; return false; }
        if (clicks == 0 || now - lastClick > 400 || now - firstClick > 900 || Math.Abs(px-x) > 16 || Math.Abs(py-y) > 16) { clicks = 0; firstClick = now; x = px; y = py; }
        lastClick = now; clicks++;
        if (clicks == 3) { clicks = 0; return true; }
        return false;
    }
}

public static class DexterityNative {
    delegate IntPtr HookProc(int n, IntPtr w, IntPtr l);
    [DllImport("user32.dll", SetLastError=true)] static extern IntPtr SetWindowsHookEx(int type, HookProc proc, IntPtr module, uint thread);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook, int n, IntPtr w, IntPtr l);
    [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string name);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h,int command);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder text, int count);
    delegate bool EnumWindowProc(IntPtr h, IntPtr data);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowProc callback, IntPtr data);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [StructLayout(LayoutKind.Sequential)] struct MouseData { public int x,y; public uint data,flags,time; public UIntPtr extra; }
    static readonly HookProc keyboard = Keyboard, mouse = Mouse;
    static readonly Gestures gestures = new Gestures();
    static readonly Stopwatch clock = Stopwatch.StartNew();
    static readonly HashSet<int> controls = new HashSet<int>();
    static readonly object outputLock = new object(), formLock = new object();
    static IntPtr kh, mh, target;
    static Control dispatcher;
    static SpeechRecognitionEngine speech;
    static bool listening, ctrlEnabled = true, tripleEnabled = true;
    static long listeningAt, lastActivation = -5000;
    static int parentPid;
    static readonly Dictionary<string, AutomationElement> fields = new Dictionary<string, AutomationElement>();
    static readonly Dictionary<string, AutomationElement> buttons = new Dictionary<string, AutomationElement>();
    static readonly Dictionary<string,string> fieldLabels = new Dictionary<string,string>(), buttonLabels = new Dictionary<string,string>();
    static string formToken, rootName;
    static IntPtr rootHandle;
    static DateTime inspectedAt;
    static Dictionary<string,string> filledValues;
    static bool submissionConsumed;

    static void Emit(object data) { lock(outputLock) { Console.WriteLine(new JavaScriptSerializer().Serialize(data)); Console.Out.Flush(); } }
    static string Text(Dictionary<string,object> d, string key, string fallback = "") { object value; return d.TryGetValue(key, out value) && value != null ? Convert.ToString(value) : fallback; }
    static void Reply(string id, object data) { Emit(new { id=id, ok=true, data=data }); }
    static string WindowTitle(IntPtr h) { var text=new StringBuilder(512); GetWindowText(h,text,512);return text.ToString(); }
    static bool IsOurWindow(IntPtr h) { uint pid; GetWindowThreadProcessId(h,out pid); string title=WindowTitle(h);return pid == parentPid || pid == Process.GetCurrentProcess().Id || title=="Dexterity" || title.StartsWith("Dexterity —"); }
    static object Windows() {
        var windows=new List<object>();
        EnumWindows((h,data)=>{string title=WindowTitle(h);if(IsWindowVisible(h) && !IsOurWindow(h) && !String.IsNullOrWhiteSpace(title) && title!="Program Manager")windows.Add(new {id=h.ToInt64().ToString(),title=title});return true;},IntPtr.Zero);
        return windows;
    }
    static void RememberTarget() { IntPtr h = GetForegroundWindow(); if (h != IntPtr.Zero && !IsOurWindow(h)) target = h; }
    static void WaitForBrowserContent(AutomationElement root) {
        string name=Process.GetProcessById(root.Current.ProcessId).ProcessName.ToLowerInvariant();
        if(!new[]{"chrome","msedge","brave","firefox","opera","vivaldi"}.Contains(name))return;
        // Chromium can populate its accessibility tree asynchronously after the first read.
        // Wait on observations only; do not relaunch, navigate, or repeat any user action.
        root.FindAll(TreeScope.Descendants,Condition.TrueCondition);
        for(int i=0;i<10;i++) {
          var document=root.FindFirst(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Document));
          if(document!=null && document.FindFirst(TreeScope.Children,Condition.TrueCondition)!=null)return;
          Thread.Sleep(150);
        }
    }
    static object OpenBrowserUrl(Dictionary<string,object> command) {
        Uri url;
        if(!Uri.TryCreate(Text(command,"url"),UriKind.Absolute,out url) || (url.Scheme!="http" && url.Scheme!="https") || !String.IsNullOrEmpty(url.UserInfo))throw new Exception("Use an http or https website address without embedded credentials.");
        long requested;string windowId=Text(command,"windowId");IntPtr h=GetForegroundWindow();
        if(!String.IsNullOrEmpty(windowId)) { if(!Int64.TryParse(windowId,out requested))throw new Exception("Choose a valid browser window.");h=new IntPtr(requested); }
        else if(IsOurWindow(h) && target!=IntPtr.Zero)h=target;
        if(h==IntPtr.Zero || !IsWindow(h) || !IsWindowVisible(h) || IsOurWindow(h))throw new Exception("Focus your signed-in browser, or select it in Work in, then try again.");
        uint pid;GetWindowThreadProcessId(h,out pid);string processName=Process.GetProcessById((int)pid).ProcessName.ToLowerInvariant();
        if(!new[]{"chrome","msedge","brave","firefox","opera","vivaldi"}.Contains(processName))throw new Exception("Select your existing signed-in browser window. Dexterity will not open a separate browser profile.");
        ShowWindow(h,9);SetForegroundWindow(h);Thread.Sleep(150);
        if(GetForegroundWindow()!=h)throw new Exception("The browser could not be focused. Focus it yourself and try again.");
        // A new tab in this exact window inherits its existing browser profile/session.
        SendKeys.SendWait("^t");Thread.Sleep(300);
        if(GetForegroundWindow()!=h)throw new Exception("Focus changed. Navigation stopped before entering the address.");
        SendKeys.SendWait("^l");Thread.Sleep(150);
        var address=AutomationElement.FocusedElement;object pattern;
        if(address==null || address.Current.ProcessId!=(int)pid || address.Current.IsPassword || address.Current.ControlType!=ControlType.Edit || !address.TryGetCurrentPattern(ValuePattern.Pattern,out pattern))throw new Exception("This browser does not expose its address bar. Open the address yourself in this browser; no separate session was created.");
        // Never enter a URL into a page field that intercepted a shortcut.
        var ancestor=address;
        while(ancestor!=null && ancestor.Current.NativeWindowHandle!=h.ToInt32()) {
          if(ancestor.Current.ControlType==ControlType.Document)throw new Exception("The page intercepted navigation. Open the address yourself in this browser.");
          ancestor=TreeWalker.ControlViewWalker.GetParent(ancestor);
        }
        if(ancestor==null)throw new Exception("Could not verify the browser address bar.");
        if(RequiresExplicitReview(address.Current.Name,address.Current.ControlType.ProgrammaticName))throw new Exception("This address control requires review. Open the address yourself in your current browser.");
        var value=(ValuePattern)pattern;
        if(value.Current.IsReadOnly || GetForegroundWindow()!=h || !Automation.Compare(address,AutomationElement.FocusedElement))throw new Exception("The browser focus changed. Navigation stopped.");
        value.SetValue(url.AbsoluteUri);
        if(value.Current.Value!=url.AbsoluteUri || GetForegroundWindow()!=h || !Automation.Compare(address,AutomationElement.FocusedElement))throw new Exception("The browser did not accept the address or focus changed. Navigation stopped.");
        SendKeys.SendWait("{ENTER}");target=h;
        return new{windowId=h.ToInt64().ToString(),session="existing",opened=true};
    }
    static void Activate(string reason) {
        if (clock.ElapsedMilliseconds-lastActivation < 1600 || listening) return;
        lastActivation = clock.ElapsedMilliseconds; RememberTarget();
        Emit(new { type="activate", reason=reason });
    }
    static IntPtr Keyboard(int n, IntPtr w, IntPtr l) {
        if (n >= 0) {
            int message = w.ToInt32(), key = Marshal.ReadInt32(l), flags = Marshal.ReadInt32(l,8);
            if ((flags & 0x10) == 0) {
                bool down = message == 0x100 || message == 0x104, up = message == 0x101 || message == 0x105;
                if (key == 0xA2 || key == 0xA3 || key == 0x11) {
                    if (down) { controls.Add(key); gestures.Control(true,clock.ElapsedMilliseconds); }
                    if (up) { controls.Remove(key); if(controls.Count == 0) gestures.Control(false,clock.ElapsedMilliseconds); }
                } else if(down) { gestures.OtherKey(); if(key == 0x1B && listening) Emit(new { type="cancel-listening" }); }
            }
        }
        return CallNextHookEx(kh,n,w,l);
    }
    static IntPtr Mouse(int n, IntPtr w, IntPtr l) {
        if(n >= 0 && (w.ToInt32() == 0x201 || w.ToInt32() == 0x204)) {
            MouseData m = (MouseData)Marshal.PtrToStructure(l,typeof(MouseData));
            if ((m.flags & 1) == 0 && gestures.Click(clock.ElapsedMilliseconds,m.x,m.y,w.ToInt32()==0x201) && tripleEnabled) Activate("triple-click");
        }
        return CallNextHookEx(mh,n,w,l);
    }
    static void StartListening() {
        if(listening) return;
        RememberTarget();
        if(speech == null) {
            var recognizers = SpeechRecognitionEngine.InstalledRecognizers();
            if(recognizers.Count == 0) throw new Exception("Install an English speech language in Windows Settings > Time & language > Speech, then restart Dexterity.");
            var recognizer = recognizers.FirstOrDefault(r => r.Culture.TwoLetterISOLanguageName == "en") ?? recognizers[0];
            speech = new SpeechRecognitionEngine(recognizer);
            speech.LoadGrammar(new DictationGrammar());
            speech.InitialSilenceTimeout = TimeSpan.FromSeconds(12);
            speech.EndSilenceTimeout = TimeSpan.FromMilliseconds(1000);
            speech.EndSilenceTimeoutAmbiguous = TimeSpan.FromMilliseconds(1400);
            speech.SpeechRecognized += (s,e) => { if(listening) Emit(new { type="transcript", text=e.Result.Text, confidence=e.Result.Confidence }); };
            speech.SpeechHypothesized += (s,e) => { if(listening) Emit(new { type="partial", text=e.Result.Text }); };
            speech.AudioLevelUpdated += (s,e) => { if(listening) Emit(new { type="audio-level", level=e.AudioLevel }); };
            speech.RecognizeCompleted += (s,e) => { listening=false; try { speech.SetInputToNull(); } catch {} Emit(new { type="listening", active=false, error=e.Error == null ? null : e.Error.Message }); };
        }
        try { speech.SetInputToDefaultAudioDevice(); }
        catch { throw new Exception("No microphone is available. Connect one and allow desktop microphone access in Windows Settings > Privacy & security > Microphone."); }
        listening=true; listeningAt=clock.ElapsedMilliseconds;
        try { speech.RecognizeAsync(RecognizeMode.Single); Emit(new { type="listening", active=true }); }
        catch { listening=false; speech.SetInputToNull(); throw; }
    }
    static void StopListening() { if(speech != null && listening) { speech.RecognizeAsyncCancel(); } }

    static object Inspect(bool remembered, string windowId) {
        lock(formLock) {
            IntPtr h = remembered && target != IntPtr.Zero ? target : GetForegroundWindow();
            long explicitHandle;
            if(!String.IsNullOrWhiteSpace(windowId)) { if(!Int64.TryParse(windowId,out explicitHandle))throw new Exception("Choose a valid window.");h=new IntPtr(explicitHandle); }
            if(h == IntPtr.Zero || !IsWindow(h) || !IsWindowVisible(h) || IsOurWindow(h)) throw new Exception("Choose your form window from the list, then inspect again.");
            var root = AutomationElement.FromHandle(h);
            WaitForBrowserContent(root);
            fields.Clear(); buttons.Clear(); fieldLabels.Clear();buttonLabels.Clear();filledValues=null; submissionConsumed=false;
            formToken=Guid.NewGuid().ToString("N"); rootHandle=h; rootName=root.Current.Name; inspectedAt=DateTime.UtcNow;
            var edits = root.FindAll(TreeScope.Descendants, new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Edit));
            var resultFields = new List<object>();
            foreach(AutomationElement el in edits) {
                if(resultFields.Count >= 40) break;
                try {
                    if(el.Current.IsPassword || el.Current.IsOffscreen || !el.Current.IsEnabled) continue;
                    object value;
                    if(!el.TryGetCurrentPattern(ValuePattern.Pattern,out value) || ((ValuePattern)value).Current.IsReadOnly) continue;
                    string name=el.Current.Name;
                    if(String.IsNullOrWhiteSpace(name) && el.Current.LabeledBy != null) name=el.Current.LabeledBy.Current.Name;
                    if(String.IsNullOrWhiteSpace(name)) continue;
                    // Browser chrome is not part of the form.
                    if(System.Text.RegularExpressions.Regex.IsMatch(name,"address and search|search or enter|search the web|address bar",System.Text.RegularExpressions.RegexOptions.IgnoreCase)) continue;
                    string id="field-"+resultFields.Count;
                    fields[id]=el;fieldLabels[id]=el.Current.Name;
                    resultFields.Add(new { id=id, label=name, value=((ValuePattern)value).Current.Value });
                } catch(ElementNotAvailableException) {} catch(InvalidOperationException) {}
            }
            var actions=root.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Button));
            var resultButtons=new List<object>();
            foreach(AutomationElement el in actions) {
                if(resultButtons.Count >= 30) break;
                try {
                    object pattern; string name=el.Current.Name;
                    if(el.Current.IsOffscreen || !el.Current.IsEnabled || String.IsNullOrWhiteSpace(name) || !el.TryGetCurrentPattern(InvokePattern.Pattern,out pattern)) continue;
                    if(!System.Text.RegularExpressions.Regex.IsMatch(name,"submit|send|save|register|sign up|create|continue|next|apply|finish|complete",System.Text.RegularExpressions.RegexOptions.IgnoreCase)) continue;
                    string id="button-"+resultButtons.Count; buttons[id]=el;buttonLabels[id]=name; resultButtons.Add(new { id=id, label=name });
                } catch(ElementNotAvailableException) {} catch(InvalidOperationException) {}
            }
            return new { token=formToken, title=rootName, fields=resultFields, buttons=resultButtons };
        }
    }
    static void ValidateForm(string token) {
        if(formToken == null || token != formToken || !IsWindow(rootHandle) || DateTime.UtcNow-inspectedAt > TimeSpan.FromMinutes(5)) throw new Exception("This form review expired. Inspect the form again.");
        var root=AutomationElement.FromHandle(rootHandle);
        if(root.Current.Name != rootName) throw new Exception("The target window changed. Inspect the form again.");
    }
    static object Fill(Dictionary<string,object> command) {
        lock(formLock) {
            ValidateForm(Text(command,"token"));
            var changes=command["values"] as Dictionary<string,object>;
            if(changes == null || changes.Count == 0) throw new Exception("Enter at least one field to fill.");
            var plan=new Dictionary<string,string>();
            // Validate every target before changing anything.
            foreach(var item in changes) {
                if(!fields.ContainsKey(item.Key)) throw new Exception("A field changed. Inspect again.");
                var el=fields[item.Key]; object p;
                if(el.Current.Name!=fieldLabels[item.Key])throw new Exception("A field label changed. Inspect again.");
                if(el.Current.IsPassword || !el.Current.IsEnabled || el.Current.IsOffscreen || !el.TryGetCurrentPattern(ValuePattern.Pattern,out p) || ((ValuePattern)p).Current.IsReadOnly) throw new Exception("A field is no longer editable. Inspect again.");
                string value=Convert.ToString(item.Value); if(value.Length>10000) throw new Exception("A field value is too long."); plan[item.Key]=value;
            }
            filledValues=null; int completed=0;
            try {
                foreach(var item in plan) {
                    var pattern=(ValuePattern)fields[item.Key].GetCurrentPattern(ValuePattern.Pattern);
                    pattern.SetValue(item.Value);
                    // Browser accessibility setters post work to the page; wait for the value to settle.
                    for(int attempt=0;attempt<30 && pattern.Current.Value!=item.Value;attempt++)Thread.Sleep(50);
                    if(pattern.Current.Value != item.Value) throw new Exception("A field did not accept its value.");
                    completed++;
                }
            } catch { throw new Exception("Filled "+completed+" of "+plan.Count+" fields. The page changed or rejected a value. Inspect again; nothing was submitted."); }
            filledValues=plan; submissionConsumed=false; return new { count=completed };
        }
    }
    static object Submit(Dictionary<string,object> command) {
        lock(formLock) {
            ValidateForm(Text(command,"token"));
            string buttonId=Text(command,"buttonId");
            if(Text(command,"confirmed") != "True" || filledValues == null || submissionConsumed) throw new Exception("Fill and review the fields before submitting.");
            if(!buttons.ContainsKey(buttonId)) throw new Exception("Choose a visible submission button.");
            foreach(var item in filledValues) {
                if(fields[item.Key].Current.Name!=fieldLabels[item.Key])throw new Exception("A field label changed after review. Inspect again.");
                if(((ValuePattern)fields[item.Key].GetCurrentPattern(ValuePattern.Pattern)).Current.Value != item.Value) throw new Exception("A field value changed after review. Inspect and fill again before submitting.");
            }
            var button=buttons[buttonId];
            if(button.Current.Name!=buttonLabels[buttonId])throw new Exception("The submission button changed. Inspect again.");
            if(!button.Current.IsEnabled || button.Current.IsOffscreen) throw new Exception("The submission button is no longer available.");
            string label=button.Current.Name; submissionConsumed=true;
            ((InvokePattern)button.GetCurrentPattern(InvokePattern.Pattern)).Invoke();
            return new { clicked=label, message="Submission button activated. Check the target app for confirmation." };
        }
    }
    static readonly object agentLock=new object();
    static readonly Dictionary<string,AutomationElement> agentControls=new Dictionary<string,AutomationElement>();
    static readonly Dictionary<string,string> agentNames=new Dictionary<string,string>();
    static readonly Dictionary<string,string> agentValues=new Dictionary<string,string>();
    static string agentToken,agentTitle;static IntPtr agentHandle;static DateTime agentAt;static AutomationElement scrollTarget;
    static string Clip(string text,int size) { return text==null?"":text.Substring(0,Math.Min(size,text.Length)); }
    static object Context(Dictionary<string,object> command) {
      lock(agentLock) {
        long id;string requested=Text(command,"windowId");
        IntPtr h=Text(command,"remembered")=="True" && target!=IntPtr.Zero?target:GetForegroundWindow();
        if(!String.IsNullOrEmpty(requested) && Int64.TryParse(requested,out id))h=new IntPtr(id);
        if(h==IntPtr.Zero || !IsWindow(h) || !IsWindowVisible(h) || IsOurWindow(h))throw new Exception("Choose the app you want help with in the Work in list, then try again.");
        SetForegroundWindow(h);target=h;
        var root=AutomationElement.FromHandle(h);
        WaitForBrowserContent(root);
        agentControls.Clear();agentNames.Clear();agentValues.Clear();scrollTarget=null;agentToken=Guid.NewGuid().ToString("N");agentHandle=h;agentTitle=root.Current.Name;agentAt=DateTime.UtcNow;
        var controls=new List<object>();var texts=new StringBuilder();string selected="";
        var all=root.FindAll(TreeScope.Descendants,Condition.TrueCondition);
        for(int i=0;i<all.Count && i<1800;i++) {
          var el=all[i];
          try {
            if(el.Current.IsPassword || el.Current.IsOffscreen || !el.Current.IsEnabled)continue;
            string name=Clip(el.Current.Name,180);object pattern;var actions=new List<string>();string value="";
            if(el.TryGetCurrentPattern(TextPattern.Pattern,out pattern)) {
              if(String.IsNullOrEmpty(selected)){try{selected=Clip(String.Join(" ",((TextPattern)pattern).GetSelection().Select(r=>r.GetText(2000)).ToArray()).Trim(),4000);}catch{}}
            }
            if(scrollTarget==null && el.TryGetCurrentPattern(ScrollPattern.Pattern,out pattern) && ((ScrollPattern)pattern).Current.VerticallyScrollable)scrollTarget=el;
            if(!String.IsNullOrWhiteSpace(name) && texts.Length<12000)texts.AppendLine(name);
            if(el.TryGetCurrentPattern(ValuePattern.Pattern,out pattern) && !((ValuePattern)pattern).Current.IsReadOnly) {value=Clip(((ValuePattern)pattern).Current.Value,2000);if(!String.IsNullOrEmpty(name))actions.Add("type");}
            if(el.TryGetCurrentPattern(InvokePattern.Pattern,out pattern))actions.Add("click");
            else if(el.TryGetCurrentPattern(ExpandCollapsePattern.Pattern,out pattern))actions.Add("click");
            if(el.TryGetCurrentPattern(SelectionItemPattern.Pattern,out pattern))actions.Add("select");
            if(el.TryGetCurrentPattern(TogglePattern.Pattern,out pattern)){actions.Add("toggle");value=((TogglePattern)pattern).Current.ToggleState.ToString();}
            if(actions.Count>0 && !String.IsNullOrWhiteSpace(name) && controls.Count<100) {
              string cid="control-"+controls.Count;agentControls[cid]=el;agentNames[cid]=el.Current.Name;
              if(actions.Contains("type"))agentValues[cid]=((ValuePattern)el.GetCurrentPattern(ValuePattern.Pattern)).Current.Value;
              controls.Add(new{id=cid,name=name,type=el.Current.ControlType.ProgrammaticName,value=value,actions=actions,requiresApproval=RequiresExplicitReview(el.Current.Name,el.Current.ControlType.ProgrammaticName)});
            }
          }catch(ElementNotAvailableException){}catch(InvalidOperationException){}
        }
        var bounds=root.Current.BoundingRectangle;
        return new{token=agentToken,expiresAt=(long)(agentAt.AddSeconds(60)-new DateTime(1970,1,1)).TotalMilliseconds,windowId=h.ToInt64().ToString(),title=agentTitle,selectedText=selected,text=Clip(texts.ToString(),12000),controls=controls,scrollable=scrollTarget!=null,scrollControl=scrollTarget==null?null:new{name=scrollTarget.Current.Name,type=scrollTarget.Current.ControlType.ProgrammaticName},bounds=new{x=bounds.X,y=bounds.Y,width=bounds.Width,height=bounds.Height}};
      }
    }
    static bool RequiresExplicitReview(string name,string type) {
      return System.Text.RegularExpressions.Regex.IsMatch((name??"")+" "+(type??""),"submit|send|pay|delete|confirm|purchase",System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    }
    static object AgentAction(Dictionary<string,object> c) {
      lock(agentLock){
        if(Text(c,"token")!=agentToken || DateTime.UtcNow-agentAt>TimeSpan.FromSeconds(60) || !IsWindow(agentHandle))throw new Exception("The screen changed or the action expired. Run the task again.");
        var root=AutomationElement.FromHandle(agentHandle);if(root.Current.Name!=agentTitle)throw new Exception("The target window changed. Run the task again.");
        string type=Text(c,"type"),cid=Text(c,"targetId"),value=Text(c,"value");
        if(value.Length>10000)throw new Exception("The value is too long.");
        SetForegroundWindow(agentHandle);
        if(Text(c,"confirmed")=="True")foreach(var item in agentValues){if(((ValuePattern)agentControls[item.Key].GetCurrentPattern(ValuePattern.Pattern)).Current.Value!=item.Value)throw new Exception("A field changed after the review. Run the task again before submitting.");}
        if(type=="scroll"){
          if(scrollTarget==null || (value!="down" && value!="up"))throw new Exception("No supported scroll area found.");
          if(RequiresExplicitReview(scrollTarget.Current.Name,scrollTarget.Current.ControlType.ProgrammaticName) && Text(c,"confirmed")!="True")throw new Exception("Review this action in Dexterity first.");
          ((ScrollPattern)scrollTarget.GetCurrentPattern(ScrollPattern.Pattern)).Scroll(ScrollAmount.NoAmount,value=="down"?ScrollAmount.LargeIncrement:ScrollAmount.LargeDecrement);
        }else{
          if(!agentControls.ContainsKey(cid))throw new Exception("Control unavailable.");
          var el=agentControls[cid];object p;
          if(el.Current.IsPassword || el.Current.IsOffscreen || !el.Current.IsEnabled || el.Current.Name!=agentNames[cid])throw new Exception("The control changed. Run the task again.");
          if(RequiresExplicitReview(el.Current.Name,el.Current.ControlType.ProgrammaticName) && Text(c,"confirmed")!="True")throw new Exception("Review this action in Dexterity first.");
          if(type!="type" && System.Text.RegularExpressions.Regex.IsMatch(el.Current.Name,@"\b(submit|send|post|publish|delete|remove|pay|buy|purchase|order|checkout|transfer|confirm|approve|accept|agree|install|uninstall|register|sign.?up|save|apply|finish|complete|create account)\b",System.Text.RegularExpressions.RegexOptions.IgnoreCase) && Text(c,"confirmed")!="True")throw new Exception("Review this action in Dexterity first.");
          if(type=="click") {
            if(System.Text.RegularExpressions.Regex.IsMatch(el.Current.Name,@"\b(submit|send|post|publish|delete|remove|pay|buy|purchase|order|checkout|transfer|confirm|approve|accept|agree|install|uninstall|register|sign.?up|save|apply|finish|complete|create account)\b",System.Text.RegularExpressions.RegexOptions.IgnoreCase) && Text(c,"confirmed")!="True")throw new Exception("Review this action in Dexterity first.");
            if(el.TryGetCurrentPattern(InvokePattern.Pattern,out p))((InvokePattern)p).Invoke();
            else if(el.TryGetCurrentPattern(ExpandCollapsePattern.Pattern,out p))((ExpandCollapsePattern)p).Expand();
            else throw new Exception("This control does not support clicking.");
          }else if(type=="type"){
            var v=(ValuePattern)el.GetCurrentPattern(ValuePattern.Pattern);if(v.Current.IsReadOnly)throw new Exception("This field is read only.");v.SetValue(value);
            for(int attempt=0;attempt<30 && v.Current.Value!=value;attempt++)Thread.Sleep(50);
            if(v.Current.Value!=value)throw new Exception("The field did not accept that value.");
          }else if(type=="select")((SelectionItemPattern)el.GetCurrentPattern(SelectionItemPattern.Pattern)).Select();
          else if(type=="toggle")((TogglePattern)el.GetCurrentPattern(TogglePattern.Pattern)).Toggle();
          else throw new Exception("Unsupported action.");
        }
        agentToken=null;return new{performed=true};
      }
    }
    static void Dispatch(Dictionary<string,object> c) {
        string id=Text(c,"id"), command=Text(c,"command");
        try {
            if(command == "listen" || command == "stop" || command == "configure" || command == "browser-url") {
                dispatcher.BeginInvoke((Action)(() => {
                    try {
                        if(command == "browser-url") { Reply(id,OpenBrowserUrl(c));return; }
                        if(command == "listen") StartListening();
                        if(command == "stop") StopListening();
                        if(command == "configure") { ctrlEnabled=Convert.ToBoolean(c["ctrl"]); tripleEnabled=Convert.ToBoolean(c["triple"]); }
                        Reply(id,new { listening=listening });
                    } catch(Exception e) { Emit(new { id=id, ok=false, error=e.Message }); }
                }));
            } else if(command == "remember") { RememberTarget(); Reply(id,new { remembered=true }); }
            else if(command == "inspect") Reply(id,Inspect(Text(c,"remembered")=="True",Text(c,"windowId")));
            else if(command == "windows") Reply(id,Windows());
            else if(command == "focus") {long handle;if(!Int64.TryParse(Text(c,"windowId"),out handle))throw new Exception("Choose a target app.");var h=new IntPtr(handle);if(!IsWindow(h)||IsOurWindow(h)||WindowTitle(h)!=Text(c,"title"))throw new Exception("The target app changed. Read the screen again.");SetForegroundWindow(h);var b=AutomationElement.FromHandle(h).Current.BoundingRectangle;Reply(id,new{bounds=new{x=b.X,y=b.Y,width=b.Width,height=b.Height}});}
            else if(command == "context") Reply(id,Context(c));
            else if(command == "act") Reply(id,AgentAction(c));
            else if(command == "fill") Reply(id,Fill(c));
            else if(command == "submit") Reply(id,Submit(c));
            else if(command == "health") Reply(id,new { hooks=kh!=IntPtr.Zero && mh!=IntPtr.Zero, recognizers=SpeechRecognitionEngine.InstalledRecognizers().Select(r=>r.Culture.Name).ToArray(), listening=listening });
            else throw new Exception("Unknown desktop command.");
        } catch(Exception e) { Emit(new { id=id, ok=false, error=e.Message }); }
    }
    [STAThread] public static void Main(string[] args) {
        if(args.Contains("--self-test")) { SelfTest(); return; }
        if(args.Contains("--test-form")) { TestForm(); return; }
        if(args.Length>0) Int32.TryParse(args[0],out parentPid);
        Console.InputEncoding=new UTF8Encoding(false); Console.OutputEncoding=new UTF8Encoding(false);
        dispatcher=new Control(); var handle=dispatcher.Handle;
        kh=SetWindowsHookEx(13,keyboard,GetModuleHandle(null),0); mh=SetWindowsHookEx(14,mouse,GetModuleHandle(null),0);
        var timer=new System.Windows.Forms.Timer(); timer.Interval=40;
        timer.Tick+=(s,e)=> {
            if((GetAsyncKeyState(0x11)&0x8000)==0 && controls.Count>0) { controls.Clear(); gestures.Control(false,clock.ElapsedMilliseconds); }
            if(gestures.Tick(clock.ElapsedMilliseconds) && ctrlEnabled) Activate("ctrl-hold");
            if(listening && clock.ElapsedMilliseconds-listeningAt>25000) StopListening();
        }; timer.Start();
        var reader=new Thread(()=> {
            string line; while((line=Console.ReadLine()) != null) {
                try { var c=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(line); Task.Run(()=>Dispatch(c)); }
                catch { Emit(new { type="native-error", error="Invalid desktop request." }); }
            }
            try { dispatcher.BeginInvoke((Action)(()=>Application.ExitThread())); } catch {}
        }); reader.IsBackground=true; reader.Start();
        Emit(new { type="ready", hooks=kh!=IntPtr.Zero && mh!=IntPtr.Zero });
        Application.Run();
        timer.Stop(); UnhookWindowsHookEx(kh); UnhookWindowsHookEx(mh); if(speech!=null) speech.Dispose();
    }
    static void Check(bool value,string message) { if(!value) throw new Exception("FAIL: "+message); }
    static void SelfTest() {
        foreach(var word in new[]{"submit","send","pay","delete","confirm","purchase"}) {
          Check(RequiresExplicitReview("prefix"+word.ToUpperInvariant()+"suffix","ControlType.Edit"),"protected name substring: "+word);
          Check(RequiresExplicitReview("Details","ControlType."+word),"protected control type: "+word);
        }
        Check(!RequiresExplicitReview("Full name","ControlType.Edit"),"ordinary field does not require review");
        var g=new Gestures(); g.Control(true,0); Check(!g.Tick(2999),"early hold"); Check(g.Tick(3000),"3 second hold"); Check(!g.Tick(5000),"one activation per hold");
        g.Control(false,5001); g.Control(true,6000); g.OtherKey(); Check(!g.Tick(10000),"Ctrl chord must not activate"); g.Control(false,10001);
        Check(!g.Click(0,20,20,true) && !g.Click(250,20,20,true) && g.Click(500,20,20,true),"triple click");
        Check(!g.Click(1000,20,20,true) && !g.Click(1600,20,20,true) && !g.Click(1900,20,20,true),"slow clicks");
        var recognizers=SpeechRecognitionEngine.InstalledRecognizers();
        if(recognizers.Count>0) {
            using(var audio=new MemoryStream()) {
                using(var synth=new SpeechSynthesizer()) { synth.SetOutputToWaveStream(audio); synth.Speak("fill this form"); synth.SetOutputToNull(); }
                audio.Position=0;
                using(var engine=new SpeechRecognitionEngine(recognizers[0])) {
                    engine.LoadGrammar(new Grammar(new GrammarBuilder("fill this form"))); engine.SetInputToWaveStream(audio);
                    var result=engine.Recognize(); Check(result!=null && result.Text=="fill this form","offline speech audio recognition");
                }
            }
        }
        Console.WriteLine("PASS: mandatory approval names/types, Ctrl threshold, release, chord suppression, triple-click timing, offline speech audio recognition.");
    }
    static void TestForm() {
        var form=new Form { Text="Dexterity practice form", Width=540, Height=360 };
        form.Shown+=(s,e)=>{ShowWindow(form.Handle,1);SetForegroundWindow(form.Handle);Console.WriteLine("FORM_READY");Console.Out.Flush();};
        var name=new TextBox { AccessibleName="Full name", Left=30, Top=45, Width=420 };
        var email=new TextBox { AccessibleName="Email address", Left=30, Top=115, Width=420 };
        var password=new TextBox { AccessibleName="Password", Left=30, Top=185, Width=420, UseSystemPasswordChar=true };
        var submit=new Button { Text="Submit registration", Left=30, Top=240, Width=180 };
        var status=new Label { Text="Not submitted", Left=240, Top=245, Width=230 };
        submit.Click+=(s,e)=> { status.Text="Submitted: "+name.Text; Console.WriteLine("SUBMITTED"); Console.Out.Flush(); };
        form.Controls.AddRange(new Control[] { new Label { Text="Full name", Left=30,Top=20 }, name, new Label { Text="Email address",Left=30,Top=90 },email,new Label { Text="Password",Left=30,Top=160 },password,submit,status });
        Application.Run(form);
    }
}
