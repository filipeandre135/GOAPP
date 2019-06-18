var manualMode = true;
var movSense = 0.00005;
var map;
var lookup = [];
var inventory;
var encountersAdded = [];
var worker;

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: currentLat, lng: currentLng },
        zoom: 15
    });
    var noPoi = [
{
    featureType: "poi",
    stylers: [
      { visibility: "off" }
    ]
}
    ];

    map.setOptions({ styles: noPoi });
    var myLatLng = new google.maps.LatLng(currentLat, currentLng);
    var icon = {
        url: '/Content/Images/trainer.png',
        scaledSize: new google.maps.Size(30, 50), // scaled size
        origin: new google.maps.Point(0, 0), // origin
        anchor: new google.maps.Point(0, 0) // anchor
    };
    marker = new google.maps.Marker({ position: myLatLng, map: map, icon: icon });


}

function Login() {
    $.ajax({
        url: '/Home/LoginPokemon',
        type: 'POST',
        contentType: 'application/json',
        complete: function (data) {
            setTimeout(InitializeMapScanning,2000);
        },
        async:false
    });
}


function UpdateLocation() {
    $.ajax({
        url: '/Home/ChangeCoords',
        type: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify({ "lat": currentLat, "lng": currentLng }),
        success: function (data) {
        }
    });
}

function UpdateMap() {
    $.ajax({
        url: '/Home/GetMapObjs',
        type: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify({ "lat": currentLat, "lng": currentLng }),
        success: function (data) {
            FillMapWithForts(data.fortlist);
            FillMapWithNearbyPokemons(data.pokelist);
            FillNearby(data.nearby);
            if (manualMode == false) {
                CatchPokemonsAuto(data.pokeList);
            }
        }
    });
}

function CatchPokemonsAuto(pokemons) {
    var i = 0;
    for (i; i < pokemons.length; i++) {
        var encounter = pokemons[i];
        BeginEncounter(encounter);
    }
}

function InitializeMapScanning() {
    setInterval(UpdateLocation, 2000);
    setInterval(UpdateMap, 10000);
}

function ChangeMode() {
    manualMode = !manualMode;
    var button = $('#ChangeModeButton');
    if (manualMode) {
        button.text('START WALKING BITCH');
        worker.terminate();
        worker = undefined;
        
        
    }
    else {
        button.text('STOP');
        if (typeof (worker) == "undefined") {
            worker = new Worker("/Scripts/AutoWalkWorker.js");
            worker.postMessage([currentLat,currentLng]);
            worker.onmessage = function (event) {
                currentLat = event.data[0];
                currentLng = event.data[1];
                marker.setPosition(new google.maps.LatLng(currentLat, currentLng));
            };
        }
    }
}

function FillNearby(nearbydata) {
    $('#Nearby').empty();
    var i = 0;
    for (i; i < nearbydata.length; i++) {
        $('#Nearby').append('<img src="/Content/Images/pokemonicons/' + nearbydata[i].PokemonId + '.ico" width="50px">');
    }
}

function FillMapWithNearbyPokemons(pokemons) {
    var i = 0;
    for (i; i < pokemons.length; i++) {
        var poke = pokemons[i];
        var icon = {
            url: '/Content/Images/pokemonicons/'+poke.PokemonId+'.ico',
            scaledSize: new google.maps.Size(50, 50), // scaled size
            origin: new google.maps.Point(0, 0), // origin
            anchor: new google.maps.Point(0, 0) // anchor
        };
        if (encountersAdded.indexOf(poke.EncounterId) == -1) {
            var myLatLng = new google.maps.LatLng(poke.Latitude, poke.Longitude);
            var pokemarker = new google.maps.Marker({ position: myLatLng, map: map, icon: icon, pokeInfo: poke });
            pokemarker.addListener('click', function () {
                var pokeinfo = this.pokeInfo;
                $('#GameWindow').data('PokeMarker', this);
                BeginEncounter(pokeinfo);
            });
            encountersAdded.push(poke.EncounterId);
        }
    }
}

function FillMapWithForts(forts){
    var i = 0;
    for(i;i<forts.length;i++){
        var fort = forts[i];
        var latlng = [fort.Latitude, fort.Longitude];
        if (isLocationFree(latlng) && fort.Type == 'Checkpoint')
        {
            lookup.push(latlng);
            var icon = {
                url: '/Content/Images/OpenPokeStop.png',
                origin: new google.maps.Point(0, 0), // origin
                anchor: new google.maps.Point(0, 0) // anchor
            };
            if (fort.CooldownCompleteTimestampMs > 0) {
                icon.url = '/Content/Images/ClosePokeStop.png';
            }

            var myLatLng = new google.maps.LatLng(fort.Latitude, fort.Longitude);
            var fortmarker = new MarkerWithLabel({ position: myLatLng, map: map, icon: icon, fortInfo: fort });
            
            fortmarker.addListener('click', function () {
                var fortInfo = this.fortInfo;
                SearchFort(fortInfo, this);
            });
            if (fort.Cooldown > 0 && new Date(fort.Cooldown) > new Date() ) {
                var timerId = countdown(new Date(fort.CooldownCompleteTimestampMs), function (ts) {
                    fortmarker.set("labelContent", ts.minutes + ':' + ts.seconds);
                },
                countdown.MINUTES | countdown.SECONDS);
            }
        }
        else {
            if (isLocationFree(latlng)) {
                var myLatLng = new google.maps.LatLng(fort.Latitude, fort.Longitude);
                var gymmarker = new MarkerWithLabel({ position: myLatLng, map: map, fortInfo: fort,labelContent:'GYM' });
            }
        }
    }
}

function SearchFort(fortInfo,marker) {
    $.ajax({
        url: '/Home/SearchFort',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({"fortid":fortInfo.FortId , "lat": fortInfo.Latitude, "lng": fortInfo.Longitude }),
        dataType: 'json',
        complete: function (data) {
            if (data.responseJSON.Result === 'Success') {
                marker.setIcon('/Content/Images/ClosePokeStop.png');
                var timerId = countdown(new Date(data.responseJSON.Cooldown), function (ts) {
                    marker.set("labelContent", ts.minutes +':'+ ts.seconds);
                },
                countdown.MINUTES | countdown.SECONDS);
            }
            var i = 0;
            $('#Log').append("POKESTOP: "+data.responseJSON.FortName+"   "+data.responseJSON.Result +"<br/>");
            for (i; i < data.responseJSON.Items.length; i++){ 
                var itemid = data.responseJSON.Items[i].ItemId;
                $('#Log').append('Gained'+ itemid  + ' <br/>');
            }
        }
    });
}

function BeginEncounter(pokeinfo) {
    $.ajax({
        url: '/Home/BeginEncounter',
        type: 'POST',
        data: JSON.stringify({ "encounterid": pokeinfo.EncounterId, "spawnpointid": pokeinfo.SpawnPointId}),
        contentType: 'application/json',
        dataType: 'json',
        success: function (data) {
            $('#GameWindow').show();
            $('#GameWindow').data('EncounterData',pokeinfo);
            $('#Log').hide();
            GetInventory();
            $('#pokeimage').attr('src', '/Content/Images/pokemonicons/' + pokeinfo.PokemonId + '.ico');
            $('#PokeCP').html(data.WildPokemon.PokemonData.Cp);
            var pokeballnr = GetNumberofItems('ItemPokeBall');
            var greatballnr = GetNumberofItems('ItemGreatBall');
            var ultraballnr = GetNumberofItems('ItemUltraBall');
            var razzberrynr = GetNumberofItems('ItemRazzBerry');
            if (pokeballnr > 0) {
                $('#pokesection').show();
                $('#pokeballnr').text('(' + pokeballnr + ')');
            }
            else {
                $('#pokesection').hide();
            }
            if (greatballnr > 0) {
                $('#greatsection').show();
                $('#greatballnr').text('(' + greatballnr + ')');
            }
            else {
                $('#greatsection').hide();
            }
            if (ultraballnr > 0) {
                $('#ultrasection').show();
                $('#ultraballnr').text('(' + ultraballnr + ')');
            }
            else {
                $('#ultrasection').hide();
            }
            if (razzberrynr > 0) {
                $('#razzsection').show();
                $('#razzBerrynr').text('(' + razzberrynr + ')');
            }
            else {
                $('#razzsection').hide();
            }
        }
    });
}

function CatchPokemon(item) {
    var encounterdata = $('#GameWindow').data('EncounterData');
    $.ajax({
        url: '/Home/CatchPokemon',
        type: 'POST',
        data: JSON.stringify({ "encounterid": encounterdata.EncounterId, "spawnpointid": encounterdata.SpawnPointId, "itemid": item }),
        contentType: 'application/json',
        dataType: 'json',
        success: function (data) {
            if (data.Status == 'CatchSuccess' || data.Status == 'CatchFlee') {
                $('#GameWindow').hide();
                $('#Log').show();
                $('#Log').append(data.Status+'! +' + data.GainedXp + 'XP</br>');
                var marker = $('#GameWindow').data('PokeMarker');
                marker.setMap(null);
            }
            else {
                alert(data.Status);
            }
        }
    });
}

function UseBerry(item) {
    var encounterdata = $('#GameWindow').data('EncounterData');
    $.ajax({
        url: '/Home/UseBerry',
        type: 'POST',
        data: JSON.stringify({ "encounterid": encounterdata.EncounterId, "spawnpointid": encounterdata.SpawnPointId, "itemId": item }),
        contentType: 'application/json',
        dataType: 'json',
        success: function (data) {
                alert('Success:'+data.Success);
        }
    });
}

function GetInventory() {
    $.ajax({
        url: '/Home/GetInventory',
        type: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        async:false,
        success: function (data) {
            inventory = data;
        }
    });
}

function BuildItemsTable() {
    if (!$.fn.DataTable.isDataTable('#ItemsTable')) {
        $('#ItemsTable').DataTable({
            ajax: {
                url: '/Home/GetInventory',
                dataSrc: 'ItemList'
            },
            columns: [
            {
                render: function (data, type, full, meta) {
                    return '<img  src="/Content/Images/Items/' + full.ItemId + '.png"/>';
                }
            },
            { data: 'ItemCount' },
            {
                render: function (data, type, full, meta) {
                    var result = "<input type='text' id='" + full.ItemId + "' class='NumberTxt'/><button class='btn btn-danger item-button' onclick=\"DeleteItems(\'" + full.ItemId + "\',$(\'#" + full.ItemId + "\').val()" + ")\">DELETE</button>";
                    if (full.ItemId == 'ItemLuckyEgg') {
                        result += "<button class='btn btn-success item-button' onclick=\"UseLuckyEgg()\">USE</button>";
                    }
                    return result;
                }
            }
            ]
        });
    }
    else {
        $('#ItemsTable').DataTable().ajax.reload(null,false);
    }
    
}

function UseLuckyEgg() {
    $.ajax({
        url: '/Home/UseLuckyEgg',
        type: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        success: function (data) {
            alert("success");
        }
    });
}

function BuildPokemonsTable() {
    if (!$.fn.DataTable.isDataTable('#PokemonsTable')) {
        $('#PokemonsTable').DataTable({
            ajax: {
                url: '/Home/GetInventory',
                dataSrc: 'Pokemons'
            },
            columns: [
            {
                render: function (data, type, full, meta) {
                    return '<img width="50" src="/Content/Images/pokemonicons/' + full.PokemonId + '.ico"/>';
                }
            },
            { data: 'PokemonId' },
            { data: 'PokemonName' },
            {
                render: function (data, type, full, meta) {
                    return new Date(full.DateCaptured).toLocaleString();
                }
            },
            { data: 'CP' },
            { data: 'Candies' },
            {
                render: function (data, type, full, meta) {
                    return '<button onclick="EvolvePokemon(\'' + full.UniqueId + '\')" class="btn btn-success">EVOLVE</button>';
                }
            },
            {
                render: function (data, type, full, meta) {
                    return '<button onclick="TransferPokemon(\'' + full.UniqueId + '\',this)" class="btn btn-success">TRANSFER</button>';
                }
            }
            ]
        });
    }
    else {
        $('#PokemonsTable').DataTable().ajax.reload(null, false);
    }
    
}
 
function BuildPokeDex() {
    GetInventory();
    $('#Pokedex').empty();
    var i = 0;
    for (i; i < 151; i++) {
        var pokedexEntry = search(i + 1, inventory.Pokedex);
        var $div = $('<div class="PokedexEntry">');
        if (typeof pokedexEntry == 'undefined') {
            $div.css('background-image', "url('/Content/Images/EmptyPokedexEntry.jpg')");
        }
        else {
            $div.css('background-image', 'url("/Content/Images/pokemonicons/' + (i + 1) + '.ico")');
        }
        $('#Pokedex').append($div);
    }
}

function BuildEggsTable() {
    if (!$.fn.DataTable.isDataTable('#EggsTable')) {
        $('#EggsTable').DataTable({
            paging: false,
            searching: false,
            ajax: {
                url: '/Home/GetInventory',
                dataSrc: 'Eggs'
            },
            columns: [
            {
                render: function (data, type, full, meta) {
                    return '<img src="/Content/Images/Items/0.png"/>';
                }
            },
            { data: 'KmTarget' },
            {
                render: function (data, type, full, meta) {
                    var percentage = Math.round((full.KmsDone / full.KmTarget) * 100);
                    return '<div class="progress">' +
                                '<div class="progress-bar" role="progressbar" aria-valuenow="' + percentage + '" aria-valuemin="0" aria-valuemax="100"' +
                                'style="width:' + percentage + '%">' + percentage + '%</div></div>';
                }
            },
            {
                render: function (data, type, full, meta) {
                    if (full.Incubator) {
                        return '<img src="/Content/Images/Items/ItemIncubatorBasicUnlimited.png"/>';
                    }
                    else {
                        var s = $("<select onchange='UseIncubator(this,\"" + full.EggId + "\")' />");
                        var availableIncubators = GetAvailableIncubators(inventory.Incubators);
                        $('<option />', { value: 0, text: "Select" }).appendTo(s);
                        var i = 0;
                        for (i; i < availableIncubators.length; i++) {
                            $('<option />', { value: availableIncubators[i].IncubatorId, text: availableIncubators[i].IncubatorName }).appendTo(s);
                        }
                        return s[0].outerHTML;
                    }
                }
            }
            ]
        });
    }
    else {
        $('#EggsTable').DataTable().ajax.reload(null,false);
    }
    
}

function GetEgg() {
    $.ajax({
        url: '/Home/GetEgg',
        type: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        success: function (data) {
            alert('Got a ' + data.PokemonId + ' and '+data.Candies +' candies.');
        }
    });
}

function DeleteItems(itemid,amount) {
    $.ajax({
        url: '/Home/DeleteInventoryItems',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ "itemId": itemid, "amount":amount }),
        dataType: 'json',
        success: function (data) {
            var table = $('#ItemsTable').DataTable();
            table.ajax.reload(null,false);
        }
    });
}

function BuildPlayerStats() {
    GetInventory();
    $('#PlayerLevel').text(inventory.PlayerStats.Level);
    $('#expbar').css('width', ((inventory.PlayerStats.Experience / inventory.PlayerStats.NextLevelExp) * 100)+'%');
    $('#expbar').text(inventory.PlayerStats.Experience +' / '+ inventory.PlayerStats.NextLevelExp);
    $('#kmswalked').text(inventory.PlayerStats.KmsWalked);
};

function EvolvePokemon(pokeid) {
    $.ajax({
        url: 'EvolvePokemon',
        type: 'POST',
        data: JSON.stringify({ "pokeId": pokeid}),
        contentType: 'application/json',
        dataType: 'json',
        success: function (data) {
            var table = $('#PokemonsTable').DataTable();
            table.ajax.reload(null,false);
        }
    });
}

function TransferPokemon(pokeid,row) {
    $.ajax({
        url: 'TransferPokemon',
        type: 'POST',
        data: JSON.stringify({ "pokeId": pokeid }),
        contentType: 'application/json',
        dataType: 'json',
        success: function (data) {
            var table = $('#PokemonsTable').DataTable();
            table.ajax.reload(null,false);
        }
    });
}

function isLocationFree(search) {
    for (var i = 0, l = lookup.length; i < l; i++) {
        if (lookup[i][0] === search[0] && lookup[i][1] === search[1]) {
            return false;
        }
    }
    return true;
}

function removeLocation(search) {
    for (var i = 0, l = lookup.length; i < l; i++) {
        if (lookup[i][0] === search[0] && lookup[i][1] === search[1]) {
            lookup.splice(i, 1);
        }
    }
}

function GetAvailableIncubators(incubators) {
    var result = [];
    var i = 0;
    for (i; i < incubators.length; i++) {
        if (incubators[i].Available) {
            result.push(incubators[i]);
        }
    }
    return result;
}

function UseIncubator(incubatorId, eggId) {
    $.ajax({
        url: 'UseIncubator',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ "incubatorid": $(incubatorId).val(), "eggid": eggId}),
        dataType: 'json',
        success: function (data) {
            console.log(data);
        }
    });
}

function GetLevelUpRewards() {
    $.ajax({
        url: 'GetLevelUpRewards',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ "level": inventory.PlayerStats.Level }),
        dataType: 'json',
        success: function (data) {
            var string = "";
            if (data.length == 0) {
                string = "No rewards";
            }
            for (var i = 0; i < data.length; i++) {
                string += 'Awarded ' + data[i].ItemCount + ' ' + data[i].ItemId + '\n';
            }
            alert(string);
        }
    });
}

function GetNumberofItems(itemid) {
    var i=0;
    var result = 0;
    for(i;i<inventory.ItemList.length;i++){
        if(inventory.ItemList[i].ItemId == itemid)
        {
            result = inventory.ItemList[i].ItemCount;
        }
    }
    return result;
}


function search(nameKey, myArray) {
    for (var i = 0; i < myArray.length; i++) {
        if (myArray[i].PokemonId === nameKey && myArray[i].Caught>0) {
            return myArray[i];
        }
    }
}

